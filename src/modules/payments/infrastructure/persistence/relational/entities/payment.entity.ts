import { Index, Column, Entity, OneToMany, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { PaymentAttemptEntity } from './payment-attempt.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity({ name: 'payment' })
@Index('UQ_payment_idempotency', ['applicationId', 'idempotencyKey'], { unique: true })
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
