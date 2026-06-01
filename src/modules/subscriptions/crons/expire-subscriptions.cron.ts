import { Cron } from '@nestjs/schedule';
import { Logger, Injectable } from '@nestjs/common';

import { SubscriptionsService } from '../subscriptions.service';
import { CronLeader } from '@/common/cron/cron-leader.service';

/** Diario 03:00 America/Caracas: mueve `active` con currentPeriodEnd < now a `past_due`. */
@Injectable()
export class ExpireSubscriptionsCron {
  private readonly logger = new Logger(ExpireSubscriptionsCron.name);

  constructor(
    private readonly subs: SubscriptionsService,
    private readonly leader: CronLeader,
  ) {}

  @Cron('0 3 * * *', { timeZone: 'America/Caracas' })
  async handle(): Promise<void> {
    await this.leader.run('expire-subscriptions', async () => {
      const now = new Date();
      const beforeNow = new Date(0); // todos los pasados
      const expired = await this.subs.findEndingBetween(beforeNow, now, 'active');

      this.logger.log(`Expiraciones a procesar: ${expired.length}`);
      for (const sub of expired) {
        try {
          await this.subs.expireToPastDue(sub);
        } catch (err) {
          this.logger.error(`Expire failed sub=${sub.id}: ${(err as Error).message}`);
        }
      }
    });
  }
}
