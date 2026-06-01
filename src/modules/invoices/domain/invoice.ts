import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
export type DisplayCurrency = 'EUR' | 'USD';
export type ChargedCurrency = 'VES' | 'USD';

export class InvoiceItem {
  @ApiProperty()
  id: string;

  @ApiProperty()
  invoiceId: string;

  @ApiPropertyOptional({ nullable: true })
  productId: string | null;

  @ApiProperty()
  description: string;

  @ApiProperty({ example: 1 })
  quantity: number;

  @ApiProperty({ example: '15.00' })
  unitAmountEur: string;

  @ApiProperty({ example: '15.00' })
  lineTotalEur: string;

  @ApiPropertyOptional({ description: 'Metadata libre (período de suscripción, subscription_id, etc.).' })
  metadata: Record<string, unknown> | null;
}

export class Invoice {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ description: 'Solo asignado tras `issue()`. Formato CLI-YYYY-NNNNNN.' })
  number: string | null;

  @ApiProperty()
  applicationId: string;

  @ApiProperty()
  customerId: string;

  @ApiProperty({ enum: ['draft', 'open', 'paid', 'void', 'uncollectible'] })
  status: InvoiceStatus;

  @ApiProperty({ enum: ['EUR', 'USD'] })
  displayCurrency: DisplayCurrency;

  @ApiProperty({ example: '30.00' })
  displayAmount: string;

  @ApiPropertyOptional({ description: 'Fuente FX usada al snapshotear la tasa (BCV vía DolarApi, etc.).' })
  fxRateSource: string | null;

  @ApiPropertyOptional({ description: 'Tasa snapshoteada (1 displayCurrency = X VES). Inmutable.' })
  fxRateUsed: string | null;

  @ApiPropertyOptional({ description: 'Fecha efectiva de la tasa.' })
  fxRateDate: string | null;

  @ApiPropertyOptional({ enum: ['VES', 'USD'] })
  chargedCurrency: ChargedCurrency | null;

  @ApiPropertyOptional({ description: 'Equivalente en chargedCurrency (lo que efectivamente paga el cliente).' })
  chargedAmount: string | null;

  @ApiPropertyOptional()
  dueDate: string | null;

  @ApiPropertyOptional()
  paidAt: Date | null;

  @ApiPropertyOptional({ description: 'Token público firmado HMAC. Asignado tras `issue()`.' })
  checkoutToken: string | null;

  @ApiPropertyOptional()
  checkoutTokenExpiresAt: Date | null;

  @ApiPropertyOptional()
  pdfUrl: string | null;

  @ApiPropertyOptional()
  notes: string | null;

  @ApiProperty({ type: [InvoiceItem] })
  items: InvoiceItem[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
