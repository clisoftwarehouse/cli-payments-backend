import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'
  | 'canceling';
export type BillingCycle = 'monthly' | 'annual';

export class Subscription {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty()
  customerId: string;

  @ApiProperty()
  productId: string;

  @ApiProperty({ enum: ['trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'canceling'] })
  status: SubscriptionStatus;

  @ApiProperty({ enum: ['monthly', 'annual'] })
  billingCycle: BillingCycle;

  @ApiProperty()
  currentPeriodStart: Date;

  @ApiProperty()
  currentPeriodEnd: Date;

  @ApiPropertyOptional({ nullable: true })
  gracePeriodUntil: Date | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Plan al que cambiará automáticamente al fin del período actual.',
  })
  scheduledProductId: string | null;

  @ApiPropertyOptional({ nullable: true })
  scheduledBillingCycle: BillingCycle | null;

  @ApiPropertyOptional({ nullable: true })
  scheduledAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  trialEndsAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  canceledAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  cancelReason: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'ID del registro equivalente en el SaaS (ej: businessId en Vitriona). UNIQUE por aplicación.',
  })
  externalSubscriptionId: string | null;

  @ApiPropertyOptional({ description: 'Libre — el SaaS guarda lo que necesite.' })
  metadata: Record<string, unknown> | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SubscriptionEvent {
  @ApiProperty()
  id: string;

  @ApiProperty()
  subscriptionId: string;

  @ApiProperty({
    description:
      'created | renewed | plan_changed | grace_period_started | past_due | downgraded | canceled | reactivated | trial_ended',
  })
  type: string;

  @ApiPropertyOptional({ nullable: true })
  fromStatus: string | null;

  @ApiPropertyOptional({ nullable: true })
  toStatus: string | null;

  @ApiProperty({ description: 'cron | admin | customer | system | webhook' })
  triggeredBy: string;

  @ApiPropertyOptional()
  metadata: Record<string, unknown> | null;

  @ApiProperty()
  createdAt: Date;
}
