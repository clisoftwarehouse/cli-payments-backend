import { Index, Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity({ name: 'fx_rate' })
@Index('UQ_fx_rate_currency_date', ['currency', 'effectiveDate'], { unique: true })
export class FxRateEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 8 })
  currency: string;

  @Column({ type: 'numeric', precision: 14, scale: 4 })
  rate: string;

  @Column({ type: 'varchar', length: 16 })
  source: string;

  @Column({ type: 'date', name: 'effective_date' })
  effectiveDate: string;

  @Column({ type: 'timestamptz', name: 'fetched_at' })
  fetchedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
