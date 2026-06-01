import { Cron } from '@nestjs/schedule';
import { Logger, Injectable } from '@nestjs/common';

import { SubscriptionsService } from '../subscriptions.service';
import { CronLeader } from '@/common/cron/cron-leader.service';

/** Diario 03:30 America/Caracas: para subs `past_due` cuyo grace expiró, downgrade a `canceled`. */
@Injectable()
export class DowngradeOnGraceCron {
  private readonly logger = new Logger(DowngradeOnGraceCron.name);

  constructor(
    private readonly subs: SubscriptionsService,
    private readonly leader: CronLeader,
  ) {}

  @Cron('30 3 * * *', { timeZone: 'America/Caracas' })
  async handle(): Promise<void> {
    await this.leader.run('downgrade-on-grace', async () => {
      const now = new Date();
      const subs = await this.subs.findExpiredGrace(now);

      this.logger.log(`Downgrades por grace expirado: ${subs.length}`);
      for (const sub of subs) {
        try {
          await this.subs.downgradeOnGraceExpiry(sub);
        } catch (err) {
          this.logger.error(`Downgrade failed sub=${sub.id}: ${(err as Error).message}`);
        }
      }
    });
  }
}
