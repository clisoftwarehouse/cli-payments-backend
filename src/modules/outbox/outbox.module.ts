import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OutboxService } from './outbox.service';
import { OutboxController } from './outbox.controller';
import { OutboxFanoutService } from './outbox-fanout.service';
import { OutboxSweeperCron } from './outbox-sweeper.cron';
import { OutboxQueue, OUTBOX_QUEUE } from './outbox-queue.service';
import { OutboxDispatchProcessor } from './outbox-dispatch.processor';
import { OutboxInternalHandlerRegistry } from './outbox-internal-handler.registry';
import { WebhooksOutgoingModule } from '@/modules/webhooks-outgoing/webhooks-outgoing.module';
import { OutboxEventEntity } from './infrastructure/persistence/relational/entities/outbox-event.entity';
import { OutboxDeliveryEntity } from './infrastructure/persistence/relational/entities/outbox-delivery.entity';
import { WebhookEndpointEntity } from '@/modules/applications/infrastructure/persistence/relational/entities/webhook-endpoint.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEventEntity, OutboxDeliveryEntity, WebhookEndpointEntity]),
    BullModule.registerQueue({ name: OUTBOX_QUEUE }),
    WebhooksOutgoingModule, // para WebhookSigner
  ],
  controllers: [OutboxController],
  providers: [
    OutboxService,
    OutboxFanoutService,
    OutboxQueue,
    OutboxDispatchProcessor,
    OutboxSweeperCron,
    OutboxInternalHandlerRegistry,
  ],
  exports: [OutboxService, OutboxQueue, OutboxInternalHandlerRegistry],
})
export class OutboxModule {}
