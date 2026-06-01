import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module, forwardRef } from '@nestjs/common';

import { PaymentsController } from './payments.controller';
import { SitefModule } from '@/modules/gateways/sitef/sitef.module';
import { InvoicesModule } from '@/modules/invoices/invoices.module';
import { CustomersModule } from '@/modules/customers/customers.module';
import { PublicCheckoutController } from './public-checkout.controller';
import { PaymentsService, PAYMENT_POLLING_QUEUE } from './payments.service';
import { PaymentPollingProcessor } from './workers/payment-polling.processor';
import { ApplicationsModule } from '@/modules/applications/applications.module';
import { OutboxModule } from '@/modules/outbox/outbox.module';
import { SubscriptionsModule } from '@/modules/subscriptions/subscriptions.module';
import { PaymentEntity } from './infrastructure/persistence/relational/entities/payment.entity';
import { PaymentAttemptEntity } from './infrastructure/persistence/relational/entities/payment-attempt.entity';
import { PaymentReceivingAccountsModule } from '@/modules/payment-receiving-accounts/payment-receiving-accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity, PaymentAttemptEntity]),
    BullModule.registerQueue({ name: PAYMENT_POLLING_QUEUE }),
    SitefModule,
    InvoicesModule,
    CustomersModule,
    ApplicationsModule,
    OutboxModule,
    forwardRef(() => SubscriptionsModule),
    PaymentReceivingAccountsModule,
  ],
  controllers: [PaymentsController, PublicCheckoutController],
  providers: [PaymentsService, PaymentPollingProcessor],
  exports: [PaymentsService],
})
export class PaymentsModule {}
