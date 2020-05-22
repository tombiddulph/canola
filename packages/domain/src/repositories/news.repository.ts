import { IDomElement } from '@actoolkit/core';
import { Maybe } from '@cleavera/types';
import { isNull } from '@cleavera/utils';

import { BattleReport } from '../classes/battle-report';
import { CompanyName } from '../classes/company-name';
import { Mob } from '../classes/mob';
import { NewsReport } from '../classes/news-report';
import { PointInTime } from '../classes/point-in-time';
import { Ticks } from '../classes/ticks';
import { MobDirection } from '../constants/mob-direction.constant';
import { MobType } from '../constants/mob-type.constant';
import { INewsContent } from '../interfaces/news-content.interface';

export class NewsRepository {
    private static readonly OUTGOING_MOB_PATTERN: RegExp = /You sent [0-9,]+ employees to (attack|defend) ([A-z0-9\s-_|.'{},=]+ \[[0-9]{1,4}]), they are set to arrive in (\d+) ticks./;
    private static readonly INCOMING_MOB_PATTERN: RegExp = /News from your sources is that in (\d+) ticks, [\d,]+ people from ([A-z0-9\s-_|.'{},=]+? \[[0-9]{1,4}]) will arrive to (attack|defend) you./;
    private static readonly STEALTH_MOB_PATTERN: RegExp = /A stealth mob has been detected, ETA now (\d+) ticks, [\d,]+ currently visible. Mob sent from ([A-z0-9\s-_|.'{},=]+? \[[0-9]{1,4}]) to (defend|attack) you./;
    private static readonly BATTLE_REPORT_PATTERN: RegExp = /Battle Report - (Attacking|Defending) ([A-z0-9\s-_|.'{},=]+ \[[0-9]{1,4}])/;

    public parseNewsReport(context: CompanyName, headerRow: IDomElement, contentRow: IDomElement): NewsReport {
        const timeOfDayElement: IDomElement = headerRow.querySelector('td:first-child > span') ?? this._throwInvalidPointInTime();
        const pointInTime: PointInTime = PointInTime.FromDateString(timeOfDayElement.textContent ?? this._throwInvalidPointInTime());

        return new NewsReport(pointInTime, this._parseContent(context, contentRow));
    }

    private _parseContent(context: CompanyName, contentRow: IDomElement): Maybe<INewsContent> {
        const mob: Maybe<Mob> = this._parseMob(context, contentRow.textContent ?? this._throwInvalidContent());

        if (!isNull(mob)) {
            return mob;
        }

        return this._parseBattleReport(contentRow);
    }

    private _parseBattleReport(contentRow: IDomElement): Maybe<BattleReport> {
        const reportHeaderElement: Maybe<IDomElement> = contentRow.querySelector('table tr') ?? null;

        if (isNull(reportHeaderElement)) {
            return null;
        }

        const reportHeaderMatch: Maybe<RegExpExecArray> = NewsRepository.BATTLE_REPORT_PATTERN.exec(reportHeaderElement.textContent ?? '');

        if (isNull(reportHeaderMatch)) {
            return null;
        }

        const type: MobType = this._getMobType(reportHeaderMatch[1]);
        const target: CompanyName = CompanyName.FromString(reportHeaderMatch[2]);

        return new BattleReport(target, type);
    }

    private _parseMob(context: CompanyName, contentString: string): Maybe<Mob> {
        const outgoingMatch: Maybe<RegExpExecArray> = NewsRepository.OUTGOING_MOB_PATTERN.exec(contentString);

        if (!isNull(outgoingMatch)) {
            const type: MobType = this._getMobType(outgoingMatch[1]);
            const target: CompanyName = CompanyName.FromString(outgoingMatch[2]);
            const eta: Ticks = Ticks.FromString(outgoingMatch[3]);

            return new Mob(context, target, eta, MobDirection.APPROACHING, type);
        }

        const incomingMatch: Maybe<RegExpExecArray> = NewsRepository.INCOMING_MOB_PATTERN.exec(contentString);

        if (!isNull(incomingMatch)) {
            const type: MobType = this._getMobType(incomingMatch[3]);
            const sender: CompanyName = CompanyName.FromString(incomingMatch[2]);
            const eta: Ticks = Ticks.FromString(incomingMatch[1]);

            return new Mob(sender, context, eta, MobDirection.APPROACHING, type);
        }

        const stealthMatch: Maybe<RegExpExecArray> = NewsRepository.STEALTH_MOB_PATTERN.exec(contentString);

        if (!isNull(stealthMatch)) {
            const type: MobType = this._getMobType(stealthMatch[3]);
            const sender: CompanyName = CompanyName.FromString(stealthMatch[2]);
            const eta: Ticks = Ticks.FromString(stealthMatch[1]);

            return new Mob(sender, context, eta, MobDirection.APPROACHING, type);
        }

        return null;
    }

    private _getMobType(typeString: string): MobType {
        if (typeString.toLowerCase().includes('defend')) {
            return MobType.DEFENDING;
        }

        return MobType.ATTACKING;
    }

    private _throwInvalidContent(): never {
        throw new Error('Invalid content');
    }

    private _throwInvalidPointInTime(): never {
        throw new Error('Invalid point in time');
    }
}
