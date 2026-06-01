import { Index, Column, Entity, OneToMany, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { SubscriptionEventEntity } from './subscription-event.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity({ name: 'subscription' })
@Index('IDX_subscription_app_status', ['applicationId', 'status'])
@Index('IDX_subscription_customer', ['customerId'])
@Index('UQ_subscription_external_id', ['applicationId', 'externalSubscriptionId'], {
  unique: true,
  where: '"external_subscription_id" IS NOT NULL',
})
export class SubscriptionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'application_id' })
  applicationId: string;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @Column({ type: 'uuid', name: 'product_id' })
  productId: string;

  @Column({ type: 'varchar', length: 16 })
  status: string;

  @Column({ type: 'varchar', length: 16, name: 'billing_cycle' })
  billingCycle: string;

  @Column({ type: 'timestamptz', name: 'current_period_start' })
  currentPeriodStart: Date;

  @Column({ type: 'timestamptz', name: 'current_period_end' })
  currentPeriodEnd: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'grace_period_until' })
  gracePeriodUntil: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'scheduled_product_id' })
  scheduledProductId: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true, name: 'scheduled_billing_cycle' })
  scheduledBillingCycle: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'scheduled_at' })
  scheduledAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'trial_ends_at' })
  trialEndsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'canceled_at' })
  canceledAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'cancel_reason' })
  cancelReason: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, name: 'external_subscription_id' })
  externalSubscriptionId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => SubscriptionEventEntity, (e) => e.subscription)
  events?: SubscriptionEventEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
