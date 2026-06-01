import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';

import { PaymentsService, PAYMENT_POLLING_QUEUE } from '../payments.service';

type JobData = { paymentId: string; nextAttemptIndex: number };

@Processor(PAYMENT_POLLING_QUEUE)
export class PaymentPollingProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentPollingProcessor.name);

  constructor(private readonly paymentsService: PaymentsService) {
    super();
  }

  async process(job: Job<JobData>): Promise<void> {
    const { paymentId, nextAttemptIndex } = job.data;

    try {
      const { done } = await this.paymentsService.pollOnce(paymentId);
      if (!done) {
        await this.paymentsService.schedulePolling(paymentId, nextAttemptIndex);
      }
    } catch (err) {
      this.logger.error(`Polling falló para payment ${paymentId}: ${(err as Error).message}`);
      // Reintentar dentro del schedule. Si ya agotamos, schedulePolling es no-op.
      await this.paymentsService.schedulePolling(paymentId, nextAttemptIndex);
    }
  }
}
