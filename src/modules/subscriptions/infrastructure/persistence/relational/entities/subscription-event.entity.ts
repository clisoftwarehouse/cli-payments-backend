import { Index, Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { SubscriptionEntity } from './subscription.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity({ name: 'subscription_event' })
@Index('IDX_subscription_event_sub', ['subscriptionId'])
export class SubscriptionEventEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'subscription_id' })
  subscriptionId: string;

  @ManyToOne(() => SubscriptionEntity, (s) => s.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription?: SubscriptionEntity;

  @Column({ type: 'varchar', length: 40 })
  type: string;

  @Column({ type: 'varchar', length: 16, nullable: true, name: 'from_status' })
  fromStatus: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true, name: 'to_status' })
  toStatus: string | null;

  @Column({ type: 'varchar', length: 24, name: 'triggered_by' })
  triggeredBy: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
