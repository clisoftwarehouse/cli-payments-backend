import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity({ name: 'counter' })
export class CounterEntity extends EntityRelationalHelper {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'bigint', default: 0 })
  value: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
