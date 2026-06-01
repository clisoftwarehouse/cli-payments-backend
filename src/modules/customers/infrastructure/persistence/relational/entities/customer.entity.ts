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

@Entity({ name: 'customer' })
@Index('UQ_customer_email_country', ['email', 'country'], { unique: true })
export class CustomerEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 320 })
  email: string;

  @Column({ type: 'varchar', length: 240, name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 2, default: 'VE' })
  country: string;

  @Column({ type: 'varchar', length: 16, nullable: true, name: 'identity_type' })
  identityType: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true, name: 'identity_value' })
  identityValue: string | null;

  @Column({ type: 'varchar', length: 240, nullable: true, name: 'legal_name' })
  legalName: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 8, default: 'es', name: 'default_locale' })
  defaultLocale: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
