import {
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

@Entity({ name: 'webhook_endpoint' })
export class WebhookEndpointEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'application_id' })
  applicationId: string;

  @ManyToOne(() => ApplicationEntity, (app) => app.webhookEndpoints, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'application_id' })
  application?: ApplicationEntity;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 255, name: 'signing_secret' })
  signingSecret: string;

  @Column({ type: 'text', array: true, default: () => "'{}'", name: 'active_events' })
  activeEvents: string[];

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
