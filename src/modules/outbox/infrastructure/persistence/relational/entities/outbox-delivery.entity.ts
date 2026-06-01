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

import { OutboxEventEntity } from './outbox-event.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity({ name: 'outbox_delivery' })
@Index('IDX_outbox_delivery_status_next', ['status', 'nextAttemptAt'])
@Index('IDX_outbox_delivery_event', ['eventId'])
@Index('IDX_outbox_delivery_target', ['targetType', 'targetId'])
export class OutboxDeliveryEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'event_id' })
  eventId: string;

  @ManyToOne(() => OutboxEventEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event?: OutboxEventEntity;

  @Column({ type: 'varchar', length: 20, name: 'target_type' })
  targetType: string;

  @Column({ type: 'uuid', nullable: true, name: 'target_id' })
  targetId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'target_descriptor' })
  targetDescriptor: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: string;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'next_attempt_at' })
  nextAttemptAt: Date | null;

  @Column({ type: 'varchar', length: 80, nullable: true, name: 'last_error_code' })
  lastErrorCode: string | null;

  @Column({ type: 'text', nullable: true, name: 'last_error_message' })
  lastErrorMessage: string | null;

  @Column({ type: 'integer', nullable: true, name: 'last_response_status' })
  lastResponseStatus: number | null;

  @Column({ type: 'text', nullable: true, name: 'last_response_body' })
  lastResponseBody: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'delivered_at' })
  deliveredAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'given_up_at' })
  givenUpAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
