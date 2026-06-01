import {
  Column,
  Entity,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Index('IDX_pra_application', ['applicationId', 'methodKind', 'isActive'])
@Entity({ name: 'payment_receiving_account' })
export class PaymentReceivingAccountEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'application_id' })
  applicationId: string;

  @Column({ type: 'varchar', length: 16, name: 'method_kind' })
  methodKind: string;

  @Column({ type: 'integer', name: 'bank_code' })
  bankCode: number;

  @Column({ type: 'varchar', length: 100, name: 'bank_name' })
  bankName: string;

  @Column({ type: 'varchar', length: 100, name: 'account_holder' })
  accountHolder: string;

  @Column({ type: 'varchar', length: 20, name: 'identity_document' })
  identityDocument: string;

  @Column({ type: 'varchar', length: 20, name: 'account_number', nullable: true })
  accountNumber: string | null;

  @Column({ type: 'varchar', length: 10, name: 'account_type', nullable: true })
  accountType: string | null;

  @Column({ type: 'varchar', length: 20, name: 'phone', nullable: true })
  phone: string | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
