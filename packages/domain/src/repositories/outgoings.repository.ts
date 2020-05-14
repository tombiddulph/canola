import { IDomElement, INJECTOR, IRequest, REQUEST } from '@actoolkit/core';
import { Maybe } from '@cleavera/types';
import { isNull } from '@cleavera/utils';

import { CompanyName } from '../classes/company-name';
import { Mob } from '../classes/mob';
import { Outgoing } from '../classes/outgoing';
import { Outgoings } from '../classes/outgoings';
import { Staff } from '../classes/staff';
import { Ticks } from '../classes/ticks';
import { UnitStats } from '../classes/unit-stats';
import { Units } from '../classes/units';
import { MobDirection } from '../constants/mob-direction.constant';
import { MobType } from '../constants/mob-type.constant';
import { UnitsRepository } from './units.repository';

export class OutgoingsRepository {
    private static readonly RETURNING_MOB_PATTERN: RegExp = /^([0-9,]+) staff returning from ([A-z0-9\s-_|.'{},=]+? \[[0-9]+]) eta ([0-9]+)/;
    private static readonly APPROACHING_MOB_PATTERN: RegExp = /^([0-9,]+) staff approaching ([A-z0-9\s-_|.'{},=]+? \[[0-9]+]) eta ([0-9]+)\. (Defending|Attacking)/;
    private static readonly THERE_MOB_PATTERN: RegExp = /^([0-9,]+) staff at ([A-z0-9\s-_|.'{},=]+? \[[0-9]+]) (Defending|Attacking) for ([1-3]) tick/;

    private readonly _request: IRequest;
    private readonly _unitsRepository: UnitsRepository;
    private _units: Maybe<Units>;

    constructor() {
        this._request = INJECTOR.get<IRequest>(REQUEST) ?? this._throwNoRequestStrategy();
        this._unitsRepository = new UnitsRepository();
        this._units = null;
    }

    public async get(): Promise<Maybe<Outgoings>> {
        const response: IDomElement = await this._request.get('/overview.php');
        const outgoingsList: Maybe<IDomElement> = response.querySelector('#Outgoing') ?? null;

        if (isNull(outgoingsList)) {
            return null;
        }

        return new Outgoings(await this._parseOutgoingList(outgoingsList));
    }

    private async _parseOutgoingList(outgoingsList: IDomElement): Promise<Array<Outgoing>> {
        const rows: Array<IDomElement> = Array.from(outgoingsList.querySelectorAll('div'));
        const mobs: Array<Promise<Outgoing>> = [];

        for (const row of rows) {
            const [, mobDetailsElement = null]: Array<Maybe<IDomElement>> = Array.from(row.querySelectorAll('a'));
            let mobDetailsLink: Maybe<string> = null;

            if (!isNull(mobDetailsElement)) {
                mobDetailsLink = mobDetailsElement.getAttribute('href');
            }

            mobs.push(this._parseRow((row.textContent ?? this._throwInvalidOutgoing()).trim(), mobDetailsLink));
        }

        return Promise.all(mobs);
    }

    private async _parseRow(row: string, mobDetailsLink: Maybe<string>): Promise<Outgoing> {
        const mob: Mob = this._parseMobRow(row);
        let staff: Maybe<Array<Staff>> = null;

        if (!isNull(mobDetailsLink)) {
            staff = await this._getStaff(mobDetailsLink);
        }

        return new Outgoing(mob, staff);
    }

    private async _getStaff(mobDetailsLink: string): Promise<Array<Staff>> {
        const response: IDomElement = await this._request.get(mobDetailsLink);
        const staffElement: IDomElement = response.querySelector('#CPBox textarea') ?? this._throwOutgoingStaff(mobDetailsLink);
        const staffInformation: string = staffElement.textContent ?? this._throwOutgoingStaff(mobDetailsLink);
        const [, staff]: Array<string> = staffInformation.trim().split('\n\n');
        const staffRows: Array<string> = staff.split('\n');

        return Promise.all(staffRows.map(async(row: string): Promise<Staff> => {
            return this._parseStaff(row);
        }));
    }

    private async _parseStaff(row: string): Promise<Staff> {
        const [name, count]: Array<string> = row.split(': ');

        return new Staff(
            name,
            parseInt(count.replace(/,/g, ''), 10),
            await this._getStaffStats(name)
        );
    }

    private _parseMobRow(row: string): Mob {
        if (OutgoingsRepository.APPROACHING_MOB_PATTERN.test(row)) {
            return this._parseApproachingMob(row);
        }

        if (OutgoingsRepository.RETURNING_MOB_PATTERN.test(row)) {
            return this._parseReturningMob(row);
        }

        if (OutgoingsRepository.THERE_MOB_PATTERN.test(row)) {
            return this._parseThereMob(row);
        }

        this._throwInvalidOutgoing(row);
    }

    private _parseReturningMob(mobString: string): Mob {
        const [, , targetString, etaString]: RegExpExecArray = OutgoingsRepository.RETURNING_MOB_PATTERN.exec(mobString) ?? this._throwInvalidOutgoing(mobString);

        return new Mob(
            CompanyName.FromString(targetString),
            Ticks.FromString(etaString),
            MobDirection.RETURNING
        );
    }

    private _parseApproachingMob(mobString: string): Mob {
        const [, , targetString, etaString, typeString]: RegExpExecArray = OutgoingsRepository.APPROACHING_MOB_PATTERN.exec(mobString) ?? this._throwInvalidOutgoing(mobString);

        return new Mob(
            CompanyName.FromString(targetString),
            Ticks.FromString(etaString),
            MobDirection.APPROACHING,
            this._getMobType(typeString)
        );
    }

    private _parseThereMob(mobString: string): Mob {
        const [, , targetString, typeString, etaString]: RegExpExecArray = OutgoingsRepository.THERE_MOB_PATTERN.exec(mobString) ?? this._throwInvalidOutgoing(mobString);

        return new Mob(
            CompanyName.FromString(targetString),
            Ticks.FromString(etaString),
            MobDirection.THERE,
            this._getMobType(typeString)
        );
    }

    private _getMobType(typeString: string): MobType {
        if (typeString === 'Defending') {
            return MobType.DEFENDING;
        }

        return MobType.ATTACKING;
    }

    private async _getStaffStats(name: string): Promise<UnitStats> {
        if (isNull(this._units)) {
            this._units = await this._unitsRepository.get();
        }

        return this._units.getByName(name) ?? this._throwNotValidStaff(name);
    }

    private _throwNoRequestStrategy(): never {
        throw new Error('No request strategy registered');
    }

    private _throwInvalidOutgoing(str: string = ''): never {
        throw new Error(`Could not parse outgoing '${str}'`);
    }

    private _throwOutgoingStaff(mobDetailsLink: string): never {
        throw new Error(`Could not parse outgoing staff '${mobDetailsLink}'`);
    }

    private _throwNotValidStaff(staffName: string): never {
        throw new Error(`Could not get staff details for staff with name ${staffName}`);
    }
}
