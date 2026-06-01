import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Logger, Injectable, OnApplicationBootstrap } from '@nestjs/common';

import { FxConfig } from './config/fx-config.type';
import { AllConfigType } from '@/config/config.type';
import { FxFetcherService } from './fx-fetcher.service';
import { CronLeader } from '@/common/cron/cron-leader.service';

@Injectable()
export class FxRatesCron implements OnApplicationBootstrap {
  private readonly logger = new Logger(FxRatesCron.name);
  private static readonly JOB_NAME = 'fx-rates-refresh';

  constructor(
    private readonly fxFetcher: FxFetcherService,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly leader: CronLeader,
  ) {}

  onApplicationBootstrap(): void {
    const fxConfig = this.configService.getOrThrow<FxConfig>('fx', { infer: true });

    const job = new CronJob(
      fxConfig.cronSchedule,
      () => {
        void this.run();
      },
      null,
      false,
      fxConfig.cronTimezone,
    );

    this.schedulerRegistry.addCronJob(FxRatesCron.JOB_NAME, job as unknown as CronJob);
    job.start();
    this.logger.log(`Cron FX programado (${fxConfig.cronSchedule} ${fxConfig.cronTimezone}).`);
  }

  async run(): Promise<void> {
    await this.leader.run('fx-rates-refresh', async () => {
      this.logger.log('Refrescando tasas FX...');
      const results = await this.fxFetcher.refreshAll();
      for (const r of results) {
        if (r.result) {
          this.logger.log(`FX ${r.currency} actualizada → ${r.result.rate} (${r.result.source}).`);
        } else {
          this.logger.error(`FX ${r.currency} NO actualizada: todas las fuentes fallaron.`);
        }
      }
    });
  }
}
