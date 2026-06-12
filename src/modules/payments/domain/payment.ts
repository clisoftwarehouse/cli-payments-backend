import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type PaymentStatus = 'pending' | 'requires_action' | 'requires_otp' | 'succeeded' | 'failed' | 'canceled';
export type PaymentMethodKind = 'c2p' | 'transfer' | 'web_button' | 'zelle' | 'pago_movil' | 'card_ccr' | 'manual';
export type Gateway = 'sitef' | 'zelle_manual' | 'manual';

export class Payment {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty()
  customerId: string;

  @ApiPropertyOptional({ nullable: true })
  invoiceId: string | null;

  @ApiProperty()
  idempotencyKey: string;

  @ApiProperty({ enum: ['pending', 'requires_action', 'requires_otp', 'succeeded', 'failed', 'canceled'] })
  status: PaymentStatus;

  @ApiProperty({ enum: ['c2p', 'transfer', 'web_button', 'zelle', 'pago_movil', 'card_ccr', 'manual'] })
  methodKind: PaymentMethodKind;

  @ApiProperty({ enum: ['sitef', 'zelle_manual', 'manual'] })
  gateway: Gateway;

  @ApiPropertyOptional({ nullable: true })
  gatewayReference: string | null;

  @ApiProperty()
  displayCurrency: string;

  @ApiProperty()
  displayAmount: string;

  @ApiPropertyOptional({ nullable: true })
  fxRateSource: string | null;

  @ApiPropertyOptional({ nullable: true })
  fxRateUsed: string | null;

  @ApiPropertyOptional({ nullable: true })
  fxRateDate: string | null;

  @ApiPropertyOptional({ nullable: true })
  chargedCurrency: string | null;

  @ApiPropertyOptional({ nullable: true })
  chargedAmount: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureCode: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureMessage: string | null;

  @ApiPropertyOptional({ nullable: true })
  succeededAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  failedAt: Date | null;

  @ApiPropertyOptional({ description: 'Datos del método guardados para reintentos/polling (no incluyen secretos).' })
  methodData: Record<string, unknown> | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaymentAttempt {
  @ApiProperty()
  id: string;

  @ApiProperty()
  paymentId: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  failureCode: string | null;

  @ApiPropertyOptional()
  failureMessage: string | null;

  @ApiPropertyOptional()
  otpState: Record<string, unknown> | null;

  @ApiPropertyOptional()
  rawRequest: Record<string, unknown> | null;

  @ApiPropertyOptional()
  rawResponse: Record<string, unknown> | null;

  @ApiPropertyOptional()
  nextPollAt: Date | null;

  @ApiProperty()
  pollCount: number;

  @ApiPropertyOptional()
  settledAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}
