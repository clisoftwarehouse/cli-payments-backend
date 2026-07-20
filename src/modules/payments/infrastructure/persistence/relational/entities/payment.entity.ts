import { Index, Column, Entity, OneToMany, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { PaymentAttemptEntity } from './payment-attempt.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity({ name: 'payment' })
@Index('UQ_payment_idempotency', ['applicationId', 'idempotencyKey'], { unique: true })
// Una referencia bancaria solo puede acreditarse UNA vez por aplicación. Índice parcial:
// solo restringe pagos ya liquidados, así los intentos fallidos con la misma referencia
// (typos, reintentos) no bloquean el intento bueno. Es la garantía dura contra el
// doble-cobro — vale aunque Sitef no marque la transacción como duplicada.
@Index('UQ_payment_reference_settled', ['applicationId', 'paymentReference'], {
  unique: true,
  where: `status = 'succeeded' AND payment_reference IS NOT NULL`,
})
@Index('IDX_payment_invoice', ['invoiceId'])
@Index('IDX_payment_status', ['status'])
export class PaymentEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'application_id' })
  applicationId: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @Column({ type: 'uuid', nullable: true, name: 'invoice_id' })
  invoiceId: string | null;

  @Column({ type: 'varchar', length: 80, name: 'idempotency_key' })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status: string;

  @Column({ type: 'varchar', length: 16, name: 'method_kind' })
  methodKind: string;

  @Column({ type: 'varchar', length: 16, default: 'sitef' })
  gateway: string;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'gateway_reference' })
  gatewayReference: string | null;

  /**
   * Referencia bancaria NORMALIZADA (últimos 8 dígitos) que identifica el movimiento que
   * paga esta factura. Es distinta de `gatewayReference`: esa la echa Sitef y a veces viene
   * recortada (pedimos 18744753 y responde 744753), así que no sirve para deduplicar.
   * Se llena con lo que tecleó el cliente (transferencia / pago móvil) o, si el método no
   * pide referencia, con la que devuelve el gateway al liquidar.
   */
  @Column({ type: 'varchar', length: 32, nullable: true, name: 'payment_reference' })
  paymentReference: string | null;

  @Column({ type: 'varchar', length: 4, name: 'display_currency' })
  displayCurrency: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'display_amount' })
  displayAmount: string;

  @Column({ type: 'varchar', length: 24, nullable: true, name: 'fx_rate_source' })
  fxRateSource: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 4, nullable: true, name: 'fx_rate_used' })
  fxRateUsed: string | null;

  @Column({ type: 'date', nullable: true, name: 'fx_rate_date' })
  fxRateDate: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true, name: 'charged_currency' })
  chargedCurrency: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true, name: 'charged_amount' })
  chargedAmount: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true, name: 'failure_code' })
  failureCode: string | null;

  @Column({ type: 'text', nullable: true, name: 'failure_message' })
  failureMessage: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'succeeded_at' })
  succeededAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'failed_at' })
  failedAt: Date | null;

  @Column({ type: 'jsonb', nullable: true, name: 'method_data' })
  methodData: Record<string, unknown> | null;

  @OneToMany(() => PaymentAttemptEntity, (a) => a.payment, { cascade: true })
  attempts?: PaymentAttemptEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
