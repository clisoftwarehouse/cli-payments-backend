import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InvoiceEntity } from './entities/invoice.entity';
import { InvoiceRepository } from '../invoice.repository';
import { InvoiceItemEntity } from './entities/invoice-item.entity';
import { InvoicesRelationalRepository } from './repositories/invoice.repository';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceEntity, InvoiceItemEntity])],
  providers: [{ provide: InvoiceRepository, useClass: InvoicesRelationalRepository }],
  exports: [InvoiceRepository],
})
export class RelationalInvoicePersistenceModule {}
