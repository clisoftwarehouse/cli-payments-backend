import {
  Index,
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { ApplicationEntity } from '@/modules/applications/infrastructure/persistence/relational/entities/application.entity';

@Entity({ name: 'merchant_terminal' })
@Index('IDX_merchant_terminal_application', ['applicationId'])
export class MerchantTerminalEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'application_id' })
  applicationId: string;

  @ManyToOne(() => ApplicationEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'application_id' })
  application?: ApplicationEntity;

  @Column({ type: 'varchar', length: 120 })
  label: string;

  @Column({ type: 'varchar', length: 120, name: 'sitef_username' })
  sitefUsername: string;

  @Column({ type: 'text', name: 'sitef_password_encrypted' })
  sitefPasswordEncrypted: string;

  @Column({ type: 'integer', name: 'sitef_idbranch' })
  sitefIdBranch: number;

  @Column({ type: 'varchar', length: 16, name: 'sitef_codestall' })
  sitefCodeStall: string;

  @Column({ type: 'integer', name: 'acquirer_bank' })
  acquirerBank: number;

  /**
   * Métodos de pago que atiende este terminal (ej. ['c2p'] para el terminal Banesco de débito
   * inmediato). NULL o vacío = terminal POR DEFECTO: atiende todo método sin terminal específico.
   * Motivación real: el contrato de Sitef cambia según el banco adquiriente del terminal, y hay
   * métodos que conviene rutear por un adquiriente distinto.
   */
  @Column({ type: 'text', array: true, nullable: true, name: 'method_kinds' })
  methodKinds: string[] | null;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
