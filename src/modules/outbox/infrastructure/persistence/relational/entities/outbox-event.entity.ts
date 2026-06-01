import { Index, Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity({ name: 'outbox_event' })
@Index('IDX_outbox_event_aggregate', ['aggregateType', 'aggregateId', 'createdAt'])
@Index('IDX_outbox_event_application', ['applicationId', 'createdAt'])
export class OutboxEventEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'application_id' })
  applicationId: string;

  @Column({ type: 'varchar', length: 40, name: 'aggregate_type' })
  aggregateType: string;

  @Column({ type: 'uuid', name: 'aggregate_id' })
  aggregateId: string;

  @Column({ type: 'varchar', length: 80, name: 'event_kind' })
  eventKind: string;

  @Column({ type: 'varchar', length: 200, name: 'delivery_key', unique: true })
  deliveryKey: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
