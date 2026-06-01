import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentEntity } from './entities/payment.entity';
import { PaymentAttemptEntity } from './entities/payment-attempt.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity, PaymentAttemptEntity])],
  exports: [TypeOrmModule],
})
export class RelationalPaymentPersistenceModule {}
