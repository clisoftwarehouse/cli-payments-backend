import { Module } from '@nestjs/common';

import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesController } from './invoices.controller';
import { CheckoutTokenService } from './checkout-token.service';
import { FxRatesModule } from '@/modules/fx-rates/fx-rates.module';
import { CountersModule } from '@/modules/counters/counters.module';
import { CustomersModule } from '@/modules/customers/customers.module';
import { ApplicationsModule } from '@/modules/applications/applications.module';
import { RelationalInvoicePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalInvoicePersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule, CountersModule, FxRatesModule, CustomersModule, ApplicationsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, CheckoutTokenService, InvoicePdfService],
  exports: [InvoicesService, CheckoutTokenService, InvoicePdfService, infrastructurePersistenceModule],
})
export class InvoicesModule {}
