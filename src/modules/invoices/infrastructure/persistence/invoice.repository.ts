import { Invoice } from '../../domain/invoice';
import { NullableType } from '@/common/utils/types/nullable.type';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';

export type InvoiceCreateInput = {
  applicationId: string;
  customerId: string;
  displayCurrency: string;
  displayAmount: string;
  dueDate?: string | null;
  notes?: string | null;
  items: Array<{
    productId?: string | null;
    description: string;
    quantity: number;
    unitAmountEur: string;
    lineTotalEur: string;
    metadata?: Record<string, unknown> | null;
  }>;
};

export type InvoiceUpdateInput = Partial<{
  status: string;
  number: string;
  fxRateSource: string;
  fxRateUsed: string;
  fxRateDate: string;
  chargedCurrency: string;
  chargedAmount: string;
  paidAt: Date;
  checkoutToken: string;
  checkoutTokenExpiresAt: Date;
  pdfUrl: string;
}>;

export abstract class InvoiceRepository {
  abstract createDraft(data: InvoiceCreateInput): Promise<Invoice>;
  abstract update(id: string, payload: InvoiceUpdateInput): Promise<Invoice>;
  abstract findById(id: string): Promise<NullableType<Invoice>>;
  abstract findByCheckoutToken(token: string): Promise<NullableType<Invoice>>;
  abstract findMany(opts: IPaginationOptions & { applicationId?: string; customerId?: string; status?: string }): Promise<Invoice[]>;
}
