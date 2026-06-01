import { SubscriptionEntity } from '../entities/subscription.entity';
import { SubscriptionEventEntity } from '../entities/subscription-event.entity';
import { Subscription, BillingCycle, SubscriptionEvent, SubscriptionStatus } from '../../../../domain/subscription';

export class SubscriptionMapper {
  static toDomain(raw: SubscriptionEntity): Subscription {
    const s = new Subscription();
    s.id = raw.id;
    s.applicationId = raw.applicationId;
    s.customerId = raw.customerId;
    s.productId = raw.productId;
    s.status = raw.status as SubscriptionStatus;
    s.billingCycle = raw.billingCycle as BillingCycle;
    s.currentPeriodStart = raw.currentPeriodStart;
    s.currentPeriodEnd = raw.currentPeriodEnd;
    s.gracePeriodUntil = raw.gracePeriodUntil;
    s.scheduledProductId = raw.scheduledProductId;
    s.scheduledBillingCycle = (raw.scheduledBillingCycle as BillingCycle) ?? null;
    s.scheduledAt = raw.scheduledAt;
    s.trialEndsAt = raw.trialEndsAt;
    s.canceledAt = raw.canceledAt;
    s.cancelReason = raw.cancelReason;
    s.externalSubscriptionId = raw.externalSubscriptionId;
    s.metadata = raw.metadata;
    s.createdAt = raw.createdAt;
    s.updatedAt = raw.updatedAt;
    return s;
  }

  static eventToDomain(raw: SubscriptionEventEntity): SubscriptionEvent {
    const e = new SubscriptionEvent();
    e.id = raw.id;
    e.subscriptionId = raw.subscriptionId;
    e.type = raw.type;
    e.fromStatus = raw.fromStatus;
    e.toStatus = raw.toStatus;
    e.triggeredBy = raw.triggeredBy;
    e.metadata = raw.metadata;
    e.createdAt = raw.createdAt;
    return e;
  }
}
