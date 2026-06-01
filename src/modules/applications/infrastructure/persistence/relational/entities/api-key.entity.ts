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

import { ApplicationEntity } from './application.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity({ name: 'api_key' })
export class ApiKeyEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'application_id' })
  applicationId: string;

  @ManyToOne(() => ApplicationEntity, (app) => app.apiKeys, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application?: ApplicationEntity;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, name: 'public_id' })
  publicId: string;

  @Column({ type: 'varchar', length: 255, name: 'secret_hash' })
  secretHash: string;

  @Column({ type: 'varchar', length: 120 })
  label: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  scopes: string[];

  @Column({ type: 'timestamptz', nullable: true, name: 'last_used_at' })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'revoked_at' })
  revokedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
