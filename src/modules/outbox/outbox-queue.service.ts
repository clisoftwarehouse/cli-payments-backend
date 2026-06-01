import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';

export const OUTBOX_QUEUE = 'outbox-deliveries';

export type DispatchJobData = { deliveryId: string };

/**
 * Wrapper sobre BullMQ para encolar dispatches.
 *
 * Patrón de uso (post-commit):
 *
 *     const { deliveryIds } = await this.dataSource.transaction(async (em) => {
 *       // ... persist state changes ...
 *       return await this.outbox.append(em, { ... });
 *     });
 *     // TX commited, ahora encola para procesamiento inmediato:
 *     await this.outboxQueue.dispatchMany(deliveryIds);
 *
 * Si el caller se olvida de llamar `dispatchMany`, el sweeper cron levanta las
 * deliveries pendientes a los pocos segundos. No es fatal, solo agrega latencia.
 */
@Injectable()
export class OutboxQueue {
  private readonly logger = new Logger(OutboxQueue.name);

  constructor(
    @InjectQueue(OUTBOX_QUEUE)
    private readonly queue: Queue,
  ) {}

  /** Encola dispatch inmediato para un delivery. */
  async dispatch(deliveryId: string): Promise<void> {
    await this.queue.add(
      'dispatch',
      { deliveryId } satisfies DispatchJobData,
      { removeOnComplete: 100, removeOnFail: 500, attempts: 1 },
    );
  }

  /** Encola dispatches en bulk. */
  async dispatchMany(deliveryIds: string[]): Promise<void> {
    if (deliveryIds.length === 0) return;
    await this.queue.addBulk(
      deliveryIds.map((id) => ({
        name: 'dispatch',
        data: { deliveryId: id } satisfies DispatchJobData,
        opts: { removeOnComplete: 100, removeOnFail: 500, attempts: 1 },
      })),
    );
  }

  /** Encola con delay (retry). */
  async dispatchDelayed(deliveryId: string, delayMs: number): Promise<void> {
    await this.queue.add(
      'dispatch',
      { deliveryId } satisfies DispatchJobData,
      { delay: delayMs, removeOnComplete: 100, removeOnFail: 500, attempts: 1 },
    );
  }
}
