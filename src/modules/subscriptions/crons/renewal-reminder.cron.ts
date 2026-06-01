import { Logger, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { SubscriptionsService } from '../subscriptions.service';
import { CronLeader } from '@/common/cron/cron-leader.service';

const REMINDER_DAYS = [7, 3, 1] as const;

/** Diario 09:00 America/Caracas: dispara `subscription.renewal_due` a 7d / 3d / 1d antes del fin de período. */
@Injectable()
export class RenewalReminderCron {
  private readonly logger = new Logger(RenewalReminderCron.name);

  constructor(
    private readonly subs: SubscriptionsService,
    private readonly leader: CronLeader,
  ) {}

  @Cron('0 9 * * *', { timeZone: 'America/Caracas' })
  async handle(): Promise<void> {
    await this.leader.run('renewal-reminder', async () => {
      for (const days of REMINDER_DAYS) {
        const start = this.startOfDayUtc(this.daysFromNow(days));
        const end = this.endOfDayUtc(this.daysFromNow(days));

        const subs = await this.subs.findEndingBetween(start, end, 'active');
        this.logger.log(`Renewal reminder T-${days}d → ${subs.length} subscripciones.`);

        for (const sub of subs) {
          try {
            await this.subs.dispatchRenewalReminder(sub, days);
          } catch (err) {
            this.logger.error(`Reminder failed sub=${sub.id}: ${(err as Error).message}`);
          }
        }
      }
    });
  }

  /** Test hook (no expuesto). */
  @Cron(CronExpression.EVERY_MINUTE, { disabled: true })
  noop(): void {}

  private daysFromNow(days: number): Date {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  private startOfDayUtc(d: Date): Date {
    const out = new Date(d);
    out.setUTCHours(0, 0, 0, 0);
    return out;
  }

  private endOfDayUtc(d: Date): Date {
    const out = new Date(d);
    out.setUTCHours(23, 59, 59, 999);
    return out;
  }
}
