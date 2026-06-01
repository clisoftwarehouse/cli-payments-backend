import { Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { InvoiceEntity } from './invoice.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity({ name: 'invoice_item' })
export class InvoiceItemEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: InvoiceEntity;

  @Column({ type: 'uuid', nullable: true, name: 'product_id' })
  productId: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'integer', default: 1 })
  quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'unit_amount_eur' })
  unitAmountEur: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'line_total_eur' })
  lineTotalEur: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
