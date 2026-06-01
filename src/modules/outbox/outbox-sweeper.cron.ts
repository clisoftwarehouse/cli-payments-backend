import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Logger, Injectable } from '@nestjs/common';

import { OutboxQueue } from './outbox-queue.service';
import { CronLeader } from '@/common/cron/cron-leader.service';
import { OutboxDeliveryEntity } from './infrastructure/persistence/relational/entities/outbox-delivery.entity';

/**
 * Safety-net del outbox. Cada 30s busca deliveries colgadas y las re-encola.
 *
 * Dos casos:
 * 1. `status='pending'` con `next_attempt_at <= now`: el caller olvidó encolar
 *    (o BullMQ perdió el job). El sweeper lo recupera.
 * 2. `status='delivering'` con `updated_at < now - 5min`: el worker crashó
 *    mid-flight. Se resetea a `pending` para que vuelva a intentar.
 *
 * Bajo `CronLeader` (advisory lock) — solo una réplica del backend ejecuta el
 * sweep en cada tick. Además, `FOR UPDATE SKIP LOCKED` da safety extra si
 * varios sweepers corren accidentalmente.
 */
@Injectable()
export class OutboxSweeperCron {
  private readonly logger = new Logger(OutboxSweeperCron.name);
  /** Cuántas filas tomar por tick. Evita grabbing excesivo. */
  private readonly batchSize = 100;
  /** Margen antes de considerar `delivering` como crashed worker. */
  private readonly delivieringStaleMs = 5 * 60 * 1000;

  constructor(
    private readonly dataSource: DataSource,
    private readonly queue: OutboxQueue,
    private readonly leader: CronLeader,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sweep(): Promise<void> {
    await this.leader.run('outbox-sweeper', async () => this.runSweep());
  }

  private async runSweep(): Promise<void> {
    const result = await this.dataSource.transaction(async (em) => {
      const stuckRows = await em
        .createQueryBuilder(OutboxDeliveryEntity, 'd')
        .select(['d.id', 'd.status'])
        .where(
          `(d.status = 'pending' AND d.nextAttemptAt <= NOW())
           OR (d.status = 'delivering' AND d.updatedAt < (NOW() - INTERVAL '${Math.floor(this.delivieringStaleMs / 1000)} seconds'))`,
        )
        .orderBy('d.nextAttemptAt', 'ASC', 'NULLS FIRST')
        .addOrderBy('d.createdAt', 'ASC')
        .limit(this.batchSize)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      if (stuckRows.length === 0) return [];

      const idsToReset = stuckRows.filter((r) => r.status === 'delivering').map((r) => r.id);
      if (idsToReset.length > 0) {
        await em
          .createQueryBuilder()
          .update(OutboxDeliveryEntity)
          .set({ status: 'pending' })
          .whereInIds(idsToReset)
          .execute();
      }

      return stuckRows.map((r) => r.id);
    });

    if (result.length > 0) {
      this.logger.log(`Sweeper re-encolando ${result.length} deliveries.`);
      await this.queue.dispatchMany(result);
    }
  }
}
