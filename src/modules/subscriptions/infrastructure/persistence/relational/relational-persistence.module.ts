import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SubscriptionEntity } from './entities/subscription.entity';
import { SubscriptionRepository } from '../subscription.repository';
import { SubscriptionEventEntity } from './entities/subscription-event.entity';
import { SubscriptionsRelationalRepository } from './repositories/subscription.repository';

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionEntity, SubscriptionEventEntity])],
  providers: [{ provide: SubscriptionRepository, useClass: SubscriptionsRelationalRepository }],
  exports: [SubscriptionRepository],
})
export class RelationalSubscriptionPersistenceModule {}
