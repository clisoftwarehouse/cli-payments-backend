import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OutboxEventEntity } from './entities/outbox-event.entity';
import { OutboxDeliveryEntity } from './entities/outbox-delivery.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEventEntity, OutboxDeliveryEntity])],
  exports: [TypeOrmModule],
})
export class OutboxRelationalPersistenceModule {}
