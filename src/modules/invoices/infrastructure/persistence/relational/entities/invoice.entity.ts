import { Index, Column, Entity, OneToMany, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { InvoiceItemEntity } from './invoice-item.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity({ name: 'invoice' })
@Index('IDX_invoice_application_status', ['applicationId', 'status'])
@Index('IDX_invoice_customer', ['customerId'])
export class InvoiceEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true, where: '"number" IS NOT NULL' })
  @Column({ type: 'varchar', length: 24, nullable: true })
  number: string | null;

  @Column({ type: 'uuid', name: 'application_id' })
  applicationId: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: string;

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

  @Column({ type: 'date', nullable: true, name: 'due_date' })
  dueDate: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'paid_at' })
  paidAt: Date | null;

  @Index({ unique: true, where: '"checkout_token" IS NOT NULL' })
  @Column({ type: 'varchar', length: 512, nullable: true, name: 'checkout_token' })
  checkoutToken: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'checkout_token_expires_at' })
  checkoutTokenExpiresAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'pdf_url' })
  pdfUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => InvoiceItemEntity, (item) => item.invoice, { cascade: true, eager: true })
  items: InvoiceItemEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
