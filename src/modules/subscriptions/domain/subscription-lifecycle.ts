/**
 * Lifecycle de Subscription como función pura.
 *
 * El servicio (`SubscriptionsService`) llama a `create()` o `apply()`, persiste el
 * `next` state que retornan, y agrega los `emit` events al outbox. La función
 * NUNCA toca DB ni dispara webhooks — solo describe la transición.
 *
 * Razones del diseño puro:
 * - Testeable sin TypeORM/PG.
 * - Cambios de policy (ej. trial → past_due vs trial → canceled directo) viven
 *   en UN solo archivo, no dispersos en cron+service+webhook.
 * - El conjunto de transiciones válidas es enumerable.
 *
 * Statuses: trialing | active | past_due | canceled | paused | canceling | unpaid
 * (`unpaid` se mantiene para compat de filas viejas; el lifecycle nuevo no lo emite.)
 */
import { SubscriptionStatus, BillingCycle } from './subscription';

export type ProductRef = { id: string; sku: string };

export type SubscriptionState = {
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  product: ProductRef;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  gracePeriodUntil: Date | null;
  scheduledProduct: ProductRef | null;
  scheduledBillingCycle: BillingCycle | null;
  scheduledAt: Date | null;
  trialEndsAt: Date | null;
  canceledAt: Date | null;
  cancelReason: string | null;
};

// ────────── Inputs ────────────────────────────────────────────────────────

export type CreateInput = {
  at: Date;
  product: ProductRef;
  billingCycle: BillingCycle;
  /** Si se provee, la sub arranca en trialing con el período = duración del trial. */
  trial?: { endsAt: Date };
};

export type LifecycleEvent =
  | { kind: 'paid'; at: Date; invoiceId: string; paymentId: string }
  | { kind: 'period_ended_unpaid'; at: Date; gracePeriodDays: number }
  | { kind: 'trial_ended'; at: Date; gracePeriodDays: number }
  | { kind: 'grace_expired'; at: Date }
  | { kind: 'cancel'; at: Date; immediate: boolean; reason: string | null }
  | { kind: 'plan_schedule'; at: Date; product: ProductRef; billingCycle: BillingCycle }
  | { kind: 'plan_change_immediate'; at: Date; product: ProductRef; billingCycle: BillingCycle }
  | { kind: 'pause'; at: Date }
  | { kind: 'resume'; at: Date }
  | { kind: 'trial_extend'; at: Date; newTrialEndsAt: Date };

export type LifecycleEventKind = LifecycleEvent['kind'];

// ────────── Output ────────────────────────────────────────────────────────

/**
 * Un evento de outbox que la transición pide emitir. El service lo pasa tal cual
 * a `OutboxService.append()`. La `deliveryKey` se construye acá para garantizar
 * idempotency a nivel de DB.
 */
export type PendingOutboxEvent = {
  eventKind: string;
  deliveryKey: string;
  payload: Record<string, unknown>;
};

export type LifecycleSuccess = {
  ok: true;
  next: SubscriptionState;
  emit: PendingOutboxEvent[];
};

export type LifecycleErrorCode = 'invalid_transition' | 'invalid_input';

export type LifecycleError = {
  ok: false;
  code: LifecycleErrorCode;
  message: string;
};

export type LifecycleResult = LifecycleSuccess | LifecycleError;

// ────────── Entry points ──────────────────────────────────────────────────

/**
 * Crea una nueva subscripción. Siempre arranca en `trialing` — representa
 * "registrada, primer pago pendiente". Si se provee `trial`, el período es
 * la duración del trial; si no, es 1 ciclo billingCycle desde `at`.
 */
export function create(subscriptionId: string, input: CreateInput): LifecycleResult {
  const periodStart = input.at;
  const periodEnd = input.trial?.endsAt ?? computePeriodEnd(periodStart, input.billingCycle);

  if (periodEnd <= periodStart) {
    return err('invalid_input', 'currentPeriodEnd debe ser posterior a currentPeriodStart.');
  }

  const next: SubscriptionState = {
    status: 'trialing',
    billingCycle: input.billingCycle,
    product: input.product,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    gracePeriodUntil: null,
    scheduledProduct: null,
    scheduledBillingCycle: null,
    scheduledAt: null,
    trialEndsAt: input.trial?.endsAt ?? null,
    canceledAt: null,
    cancelReason: null,
  };

  return ok(next, [
    {
      eventKind: 'subscription.created',
      deliveryKey: `sub_${subscriptionId}.created`,
      payload: {
        subscription_id: subscriptionId,
        product_id: input.product.id,
        product_sku: input.product.sku,
        billing_cycle: input.billingCycle,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        trial_ends_at: input.trial?.endsAt.toISOString() ?? null,
        status: 'trialing',
      },
    },
  ]);
}

/**
 * Aplica un evento al estado actual y devuelve el siguiente estado + eventos
 * a emitir. Si la transición no es válida, devuelve `LifecycleError`.
 */
export function apply(
  subscriptionId: string,
  prev: SubscriptionState,
  event: LifecycleEvent,
): LifecycleResult {
  switch (event.kind) {
    case 'paid':
      return applyPaid(subscriptionId, prev, event);
    case 'period_ended_unpaid':
      return applyPeriodEndedUnpaid(subscriptionId, prev, event);
    case 'trial_ended':
      return applyTrialEnded(subscriptionId, prev, event);
    case 'grace_expired':
      return applyGraceExpired(subscriptionId, prev, event);
    case 'cancel':
      return applyCancel(subscriptionId, prev, event);
    case 'plan_schedule':
      return applyPlanSchedule(prev, event);
    case 'plan_change_immediate':
      return applyPlanChangeImmediate(subscriptionId, prev, event);
    case 'pause':
      return applyPause(subscriptionId, prev, event);
    case 'resume':
      return applyResume(subscriptionId, prev, event);
    case 'trial_extend':
      return applyTrialExtend(prev, event);
  }
}

// ────────── Transitions ───────────────────────────────────────────────────

function applyPaid(
  subId: string,
  prev: SubscriptionState,
  event: Extract<LifecycleEvent, { kind: 'paid' }>,
): LifecycleResult {
  if (prev.status === 'canceled' || prev.status === 'unpaid') {
    return err('invalid_transition', `No se puede aceptar paid en status=${prev.status}.`);
  }
  if (prev.status === 'paused') {
    return err('invalid_transition', 'Subscription pausada — debe resumir antes de aceptar payment.');
  }

  // Si hay scheduled plan/cycle, ahora se aplican.
  const effectiveProduct = prev.scheduledProduct ?? prev.product;
  const effectiveCycle = prev.scheduledBillingCycle ?? prev.billingCycle;
  const planChanged =
    prev.scheduledProduct !== null &&
    (prev.scheduledProduct.id !== prev.product.id || prev.scheduledBillingCycle !== prev.billingCycle);

  // First payment de trialing: el período actual se confirma, NO se avanza.
  // Para active/past_due/canceling: avanza al siguiente período.
  const isFirstPayment = prev.status === 'trialing';
  const newPeriodStart = isFirstPayment ? prev.currentPeriodStart : prev.currentPeriodEnd;
  const newPeriodEnd = isFirstPayment
    ? prev.currentPeriodEnd
    : computePeriodEnd(newPeriodStart, effectiveCycle);

  const next: SubscriptionState = {
    ...prev,
    status: 'active',
    product: effectiveProduct,
    billingCycle: effectiveCycle,
    currentPeriodStart: newPeriodStart,
    currentPeriodEnd: newPeriodEnd,
    gracePeriodUntil: null,
    scheduledProduct: null,
    scheduledBillingCycle: null,
    scheduledAt: null,
    // paid revierte un cancel-at-period-end programado
    canceledAt: null,
    cancelReason: null,
  };

  const emit: PendingOutboxEvent[] = [
    {
      eventKind: 'subscription.renewed',
      deliveryKey: `sub_${subId}.renewed.${newPeriodStart.toISOString()}`,
      payload: {
        subscription_id: subId,
        product_id: effectiveProduct.id,
        product_sku: effectiveProduct.sku,
        billing_cycle: effectiveCycle,
        current_period_start: newPeriodStart.toISOString(),
        current_period_end: newPeriodEnd.toISOString(),
        status: 'active',
        invoice_id: event.invoiceId,
        payment_id: event.paymentId,
        first_payment: isFirstPayment,
      },
    },
  ];

  if (planChanged) {
    emit.push({
      eventKind: 'subscription.plan_changed',
      deliveryKey: `sub_${subId}.plan_changed.${newPeriodStart.toISOString()}`,
      payload: {
        subscription_id: subId,
        from_product_id: prev.product.id,
        from_product_sku: prev.product.sku,
        to_product_id: effectiveProduct.id,
        to_product_sku: effectiveProduct.sku,
        billing_cycle: effectiveCycle,
        effective_at: newPeriodStart.toISOString(),
      },
    });
  }

  return ok(next, emit);
}

function applyPeriodEndedUnpaid(
  subId: string,
  prev: SubscriptionState,
  event: Extract<LifecycleEvent, { kind: 'period_ended_unpaid' }>,
): LifecycleResult {
  if (prev.status !== 'active' && prev.status !== 'canceling') {
    return err('invalid_transition', `period_ended_unpaid requiere status=active|canceling, got ${prev.status}.`);
  }

  // Active → past_due con grace. Canceling → canceled inmediato (el cancel se materializa).
  if (prev.status === 'canceling') {
    const next: SubscriptionState = {
      ...prev,
      status: 'canceled',
      gracePeriodUntil: null,
      // canceledAt se preservó del schedule original
    };
    return ok(next, [
      {
        eventKind: 'subscription.canceled',
        deliveryKey: `sub_${subId}.canceled`,
        payload: {
          subscription_id: subId,
          reason: prev.cancelReason ?? 'scheduled_cancel_completed',
          canceled_at: event.at.toISOString(),
        },
      },
    ]);
  }

  // active → past_due
  const grace = new Date(event.at.getTime() + event.gracePeriodDays * 86400_000);
  const next: SubscriptionState = {
    ...prev,
    status: 'past_due',
    gracePeriodUntil: grace,
  };
  return ok(next, [
    {
      eventKind: 'subscription.past_due',
      deliveryKey: `sub_${subId}.past_due.${prev.currentPeriodEnd.toISOString()}`,
      payload: {
        subscription_id: subId,
        product_id: prev.product.id,
        product_sku: prev.product.sku,
        current_period_end: prev.currentPeriodEnd.toISOString(),
        grace_period_until: grace.toISOString(),
      },
    },
  ]);
}

function applyTrialEnded(
  subId: string,
  prev: SubscriptionState,
  event: Extract<LifecycleEvent, { kind: 'trial_ended' }>,
): LifecycleResult {
  if (prev.status !== 'trialing') {
    return err('invalid_transition', `trial_ended requiere status=trialing, got ${prev.status}.`);
  }
  const grace = new Date(event.at.getTime() + event.gracePeriodDays * 86400_000);
  const next: SubscriptionState = {
    ...prev,
    status: 'past_due',
    gracePeriodUntil: grace,
    // Marcador: este past_due viene de trial expirado, no de active que no pagó renovación.
    // El cancelReason se guarda para que `grace_expired` emita reason='trial_expired'.
    cancelReason: 'trial_expired',
  };
  return ok(next, [
    {
      eventKind: 'subscription.trial_ended',
      deliveryKey: `sub_${subId}.trial_ended`,
      payload: {
        subscription_id: subId,
        trial_ended_at: event.at.toISOString(),
        grace_period_until: grace.toISOString(),
      },
    },
  ]);
}

function applyGraceExpired(
  subId: string,
  prev: SubscriptionState,
  event: Extract<LifecycleEvent, { kind: 'grace_expired' }>,
): LifecycleResult {
  if (prev.status !== 'past_due') {
    return err('invalid_transition', `grace_expired requiere status=past_due, got ${prev.status}.`);
  }
  const reason = prev.cancelReason === 'trial_expired' ? 'trial_expired' : 'grace_expired';
  const next: SubscriptionState = {
    ...prev,
    status: 'canceled',
    canceledAt: event.at,
    cancelReason: reason,
    gracePeriodUntil: null,
  };
  return ok(next, [
    {
      eventKind: 'subscription.canceled',
      deliveryKey: `sub_${subId}.canceled`,
      payload: {
        subscription_id: subId,
        reason,
        canceled_at: event.at.toISOString(),
      },
    },
  ]);
}

function applyCancel(
  subId: string,
  prev: SubscriptionState,
  event: Extract<LifecycleEvent, { kind: 'cancel' }>,
): LifecycleResult {
  if (prev.status === 'canceled') {
    return err('invalid_transition', 'Subscription ya está canceled.');
  }

  if (event.immediate) {
    const next: SubscriptionState = {
      ...prev,
      status: 'canceled',
      canceledAt: event.at,
      cancelReason: event.reason ?? 'user_requested',
      gracePeriodUntil: null,
      scheduledProduct: null,
      scheduledBillingCycle: null,
      scheduledAt: null,
    };
    return ok(next, [
      {
        eventKind: 'subscription.canceled',
        deliveryKey: `sub_${subId}.canceled`,
        payload: {
          subscription_id: subId,
          reason: event.reason ?? 'user_requested',
          canceled_at: event.at.toISOString(),
          immediate: true,
        },
      },
    ]);
  }

  // Cancel-at-period-end. Status → canceling. No se emite evento ahora —
  // el subscription.canceled se emite cuando el período termine (period_ended_unpaid).
  if (prev.status === 'trialing' || prev.status === 'active' || prev.status === 'paused' || prev.status === 'past_due') {
    const next: SubscriptionState = {
      ...prev,
      status: 'canceling',
      canceledAt: event.at,
      cancelReason: event.reason ?? 'user_requested',
      scheduledProduct: null,
      scheduledBillingCycle: null,
      scheduledAt: null,
    };
    return ok(next, []);
  }

  return err('invalid_transition', `cancel(end) no aplicable en status=${prev.status}.`);
}

function applyPlanSchedule(
  prev: SubscriptionState,
  event: Extract<LifecycleEvent, { kind: 'plan_schedule' }>,
): LifecycleResult {
  if (prev.status !== 'active' && prev.status !== 'trialing') {
    return err('invalid_transition', `plan_schedule requiere status=active|trialing, got ${prev.status}.`);
  }
  const next: SubscriptionState = {
    ...prev,
    scheduledProduct: event.product,
    scheduledBillingCycle: event.billingCycle,
    scheduledAt: event.at,
  };
  return ok(next, []);
}

function applyPlanChangeImmediate(
  subId: string,
  prev: SubscriptionState,
  event: Extract<LifecycleEvent, { kind: 'plan_change_immediate' }>,
): LifecycleResult {
  if (prev.status !== 'active' && prev.status !== 'trialing') {
    return err('invalid_transition', `plan_change_immediate requiere status=active|trialing, got ${prev.status}.`);
  }
  if (event.product.id === prev.product.id && event.billingCycle === prev.billingCycle) {
    return err('invalid_input', 'El producto/ciclo nuevo es igual al actual.');
  }
  const next: SubscriptionState = {
    ...prev,
    product: event.product,
    billingCycle: event.billingCycle,
    scheduledProduct: null,
    scheduledBillingCycle: null,
    scheduledAt: null,
  };
  return ok(next, [
    {
      eventKind: 'subscription.plan_changed',
      deliveryKey: `sub_${subId}.plan_changed.${event.at.toISOString()}`,
      payload: {
        subscription_id: subId,
        from_product_id: prev.product.id,
        from_product_sku: prev.product.sku,
        to_product_id: event.product.id,
        to_product_sku: event.product.sku,
        billing_cycle: event.billingCycle,
        effective_at: event.at.toISOString(),
        immediate: true,
      },
    },
  ]);
}

function applyPause(
  subId: string,
  prev: SubscriptionState,
  event: Extract<LifecycleEvent, { kind: 'pause' }>,
): LifecycleResult {
  if (prev.status !== 'active') {
    return err('invalid_transition', `pause requiere status=active, got ${prev.status}.`);
  }
  const next: SubscriptionState = { ...prev, status: 'paused' };
  return ok(next, [
    {
      eventKind: 'subscription.paused',
      deliveryKey: `sub_${subId}.paused.${event.at.toISOString()}`,
      payload: { subscription_id: subId, paused_at: event.at.toISOString() },
    },
  ]);
}

function applyResume(
  subId: string,
  prev: SubscriptionState,
  event: Extract<LifecycleEvent, { kind: 'resume' }>,
): LifecycleResult {
  if (prev.status !== 'paused') {
    return err('invalid_transition', `resume requiere status=paused, got ${prev.status}.`);
  }
  const next: SubscriptionState = { ...prev, status: 'active' };
  return ok(next, [
    {
      eventKind: 'subscription.resumed',
      deliveryKey: `sub_${subId}.resumed.${event.at.toISOString()}`,
      payload: { subscription_id: subId, resumed_at: event.at.toISOString() },
    },
  ]);
}

function applyTrialExtend(
  prev: SubscriptionState,
  event: Extract<LifecycleEvent, { kind: 'trial_extend' }>,
): LifecycleResult {
  if (prev.status !== 'trialing') {
    return err('invalid_transition', `trial_extend requiere status=trialing, got ${prev.status}.`);
  }
  if (event.newTrialEndsAt <= (prev.trialEndsAt ?? prev.currentPeriodEnd)) {
    return err('invalid_input', 'newTrialEndsAt debe ser posterior a trialEndsAt actual.');
  }
  const next: SubscriptionState = {
    ...prev,
    currentPeriodEnd: event.newTrialEndsAt,
    trialEndsAt: event.newTrialEndsAt,
  };
  return ok(next, []);
}

// ────────── Helpers ───────────────────────────────────────────────────────

/** Suma 1 ciclo billingCycle a `start` en UTC. Mantiene día-del-mes cuando aplica. */
export function computePeriodEnd(start: Date, cycle: BillingCycle): Date {
  const d = new Date(start);
  if (cycle === 'annual') {
    d.setUTCFullYear(d.getUTCFullYear() + 1);
  } else {
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d;
}

function ok(next: SubscriptionState, emit: PendingOutboxEvent[]): LifecycleSuccess {
  return { ok: true, next, emit };
}

function err(code: LifecycleErrorCode, message: string): LifecycleError {
  return { ok: false, code, message };
}
