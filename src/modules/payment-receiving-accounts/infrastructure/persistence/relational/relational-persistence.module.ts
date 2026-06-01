import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentReceivingAccountEntity } from './entities/payment-receiving-account.entity';
import { PaymentReceivingAccountRepository } from '../payment-receiving-account.repository';
import { PaymentReceivingAccountsRelationalRepository } from './repositories/payment-receiving-account.repository';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentReceivingAccountEntity])],
  providers: [
    {
      provide: PaymentReceivingAccountRepository,
      useClass: PaymentReceivingAccountsRelationalRepository,
    },
  ],
  exports: [PaymentReceivingAccountRepository],
})
export class RelationalPaymentReceivingAccountPersistenceModule {}
