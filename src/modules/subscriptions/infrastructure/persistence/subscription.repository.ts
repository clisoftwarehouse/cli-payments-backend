import { NullableType } from '@/common/utils/types/nullable.type';
import { Subscription, SubscriptionEvent } from '../../domain/subscription';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';

export type SubscriptionCreateInput = {
  applicationId: string;
  customerId: string;
  productId: string;
  status: string;
  billingCycle: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date | null;
  externalSubscriptionId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SubscriptionEventInput = {
  subscriptionId: string;
  type: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  triggeredBy: string;
  metadata?: Record<string, unknown> | null;
};

export abstract class SubscriptionRepository {
  abstract create(data: SubscriptionCreateInput): Promise<Subscription>;
  abstract update(id: string, payload: Partial<Subscription>): Promise<Subscription>;
  abstract findById(id: string): Promise<NullableType<Subscription>>;
  abstract findByExternalId(applicationId: string, externalId: string): Promise<NullableType<Subscription>>;
  abstract findMany(
    opts: IPaginationOptions & { applicationId?: string; customerId?: string; status?: string },
  ): Promise<Subscription[]>;

  /** Para crons: subs cuyo `currentPeriodEnd` está dentro de un rango. */
  abstract findEndingBetween(start: Date, end: Date, status: string): Promise<Subscription[]>;

  /** Para crons: subs en `past_due` cuyo grace ya expiró. */
  abstract findExpiredGrace(now: Date): Promise<Subscription[]>;

  abstract recordEvent(event: SubscriptionEventInput): Promise<SubscriptionEvent>;
  abstract listEvents(subscriptionId: string): Promise<SubscriptionEvent[]>;
}
