import {
  Index,
  Column,
  Entity,
  CreateDateColumn,
  DeleteDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity({ name: 'product' })
export class ProductEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  sku: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 24 })
  kind: string;

  @Column({ type: 'varchar', length: 4, name: 'price_currency' })
  priceCurrency: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'price_amount' })
  priceAmount: string;

  @Column({ type: 'varchar', length: 16, nullable: true, name: 'billing_interval' })
  billingInterval: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true, name: 'plan_features' })
  planFeatures: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true, name: 'application_id' })
  applicationId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
