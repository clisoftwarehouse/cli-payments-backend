import { Module, forwardRef } from '@nestjs/common';

import { SubscriptionsService } from './subscriptions.service';
import { RenewalReminderCron } from './crons/renewal-reminder.cron';
import { MailerModule } from '@/modules/mailer/mailer.module';
import { InvoicesModule } from '@/modules/invoices/invoices.module';
import { ProductsModule } from '@/modules/products/products.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { CustomersModule } from '@/modules/customers/customers.module';
import { SubscriptionsController } from './subscriptions.controller';
import { DowngradeOnGraceCron } from './crons/downgrade-on-grace.cron';
import { ExpireSubscriptionsCron } from './crons/expire-subscriptions.cron';
import { SaasSubscriptionsController } from './saas-subscriptions.controller';
import { AuthApiKeyModule } from '@/modules/auth-api-key/auth-api-key.module';
import { OutboxModule } from '@/modules/outbox/outbox.module';
import { ApplicationsModule } from '@/modules/applications/applications.module';
import { WebhooksOutgoingModule } from '@/modules/webhooks-outgoing/webhooks-outgoing.module';
import { RenewalReminderEmailHandler } from './handlers/renewal-reminder-email.handler';
import { RelationalSubscriptionPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalSubscriptionPersistenceModule;

@Module({
  imports: [
    infrastructurePersistenceModule,
    ProductsModule,
    InvoicesModule,
    OutboxModule,
    MailerModule,
    CustomersModule,
    ApplicationsModule,
    WebhooksOutgoingModule,
    AuthApiKeyModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [SubscriptionsController, SaasSubscriptionsController],
  providers: [
    SubscriptionsService,
    RenewalReminderCron,
    ExpireSubscriptionsCron,
    DowngradeOnGraceCron,
    RenewalReminderEmailHandler,
  ],
  exports: [SubscriptionsService, infrastructurePersistenceModule],
})
export class SubscriptionsModule {}
