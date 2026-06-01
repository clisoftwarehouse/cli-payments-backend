import { Module } from '@nestjs/common';

import { PaymentReceivingAccountsService } from './payment-receiving-accounts.service';
import { PaymentReceivingAccountsController } from './payment-receiving-accounts.controller';
import { RelationalPaymentReceivingAccountPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalPaymentReceivingAccountPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [PaymentReceivingAccountsController],
  providers: [PaymentReceivingAccountsService],
  exports: [PaymentReceivingAccountsService, infrastructurePersistenceModule],
})
export class PaymentReceivingAccountsModule {}
