import { InvoiceEntity } from '../entities/invoice.entity';
import { InvoiceItemEntity } from '../entities/invoice-item.entity';
import { Invoice, InvoiceItem, InvoiceStatus, DisplayCurrency, ChargedCurrency } from '../../../../domain/invoice';

export class InvoiceMapper {
  static toDomain(raw: InvoiceEntity): Invoice {
    const d = new Invoice();
    d.id = raw.id;
    d.number = raw.number;
    d.applicationId = raw.applicationId;
    d.customerId = raw.customerId;
    d.status = raw.status as InvoiceStatus;
    d.displayCurrency = raw.displayCurrency as DisplayCurrency;
    d.displayAmount = raw.displayAmount;
    d.fxRateSource = raw.fxRateSource;
    d.fxRateUsed = raw.fxRateUsed;
    d.fxRateDate = raw.fxRateDate;
    d.chargedCurrency = (raw.chargedCurrency as ChargedCurrency) ?? null;
    d.chargedAmount = raw.chargedAmount;
    d.dueDate = raw.dueDate;
    d.paidAt = raw.paidAt;
    d.checkoutToken = raw.checkoutToken;
    d.checkoutTokenExpiresAt = raw.checkoutTokenExpiresAt;
    d.pdfUrl = raw.pdfUrl;
    d.notes = raw.notes;
    d.items = (raw.items ?? []).map(InvoiceMapper.itemToDomain);
    d.createdAt = raw.createdAt;
    d.updatedAt = raw.updatedAt;
    return d;
  }

  static itemToDomain(raw: InvoiceItemEntity): InvoiceItem {
    const i = new InvoiceItem();
    i.id = raw.id;
    i.invoiceId = raw.invoiceId;
    i.productId = raw.productId;
    i.description = raw.description;
    i.quantity = raw.quantity;
    i.unitAmountEur = raw.unitAmountEur;
    i.lineTotalEur = raw.lineTotalEur;
    i.metadata = raw.metadata;
    return i;
  }
}
