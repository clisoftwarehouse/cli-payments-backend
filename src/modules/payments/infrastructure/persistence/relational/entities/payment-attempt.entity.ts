import { Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { PaymentEntity } from './payment.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity({ name: 'payment_attempt' })
export class PaymentAttemptEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'payment_id' })
  paymentId: string;

  @ManyToOne(() => PaymentEntity, (p) => p.attempts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment?: PaymentEntity;

  @Column({ type: 'varchar', length: 24 })
  status: string;

  @Column({ type: 'varchar', length: 80, nullable: true, name: 'failure_code' })
  failureCode: string | null;

  @Column({ type: 'text', nullable: true, name: 'failure_message' })
  failureMessage: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'otp_state' })
  otpState: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'raw_request' })
  rawRequest: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'raw_response' })
  rawResponse: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'next_poll_at' })
  nextPollAt: Date | null;

  @Column({ type: 'integer', default: 0, name: 'poll_count' })
  pollCount: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'settled_at' })
  settledAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
