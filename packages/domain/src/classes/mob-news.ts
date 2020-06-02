import { Maybe } from '@cleavera/types';

import { MobDirection } from '../constants/mob-direction.constant';
import { CompanyName } from './company-name';
import { Mob } from './mob';
import { Ticks } from './ticks';

export class MobNews {
    public readonly mob: Maybe<Mob>;
    public readonly count: number;
    public readonly originalMob: Mob;
    public readonly context: CompanyName;
    public readonly isOutgoing: boolean;

    constructor(context: CompanyName, count: number, mob: Maybe<Mob>, originalMob: Mob) {
        this.mob = mob;
        this.count = count;
        this.originalMob = originalMob;
        this.context = context;
        this.isOutgoing = originalMob.sender.id === this.context.id;
    }

    public static adjustedMob(tickDifference: Ticks, mob: Mob): Maybe<Mob> {
        const etaDifference: Ticks = Ticks.Subtract(mob.eta, tickDifference);

        if (etaDifference.ticks > 0) {
            return new Mob(mob.sender, mob.target, etaDifference, MobDirection.APPROACHING, mob.type);
        }

        const thereForDifference: Ticks = Ticks.Add(Mob.THERE_FOR_TICKS, etaDifference);

        if (thereForDifference.ticks > 0) {
            return new Mob(mob.sender, mob.target, thereForDifference, MobDirection.THERE, mob.type);
        }

        const returningEtaDifference: Ticks = Ticks.Add(mob.eta, thereForDifference);

        if (returningEtaDifference.ticks > 0) {
            return new Mob(mob.sender, mob.target, returningEtaDifference, MobDirection.RETURNING, mob.type);
        }

        return null;
    }

    public static FromOriginalMob(context: CompanyName, count: number, mob: Mob, tickSinceSent: Ticks): MobNews {
        return new MobNews(context, count, this.adjustedMob(tickSinceSent, mob), mob);
    }
}
