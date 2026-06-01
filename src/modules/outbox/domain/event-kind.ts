/**
 * Catálogo cerrado de eventos emitidos por el outbox.
 *
 * Para agregar uno nuevo:
 *   1. Suma el literal acá.
 *   2. Si lo va a emitir un caller, lo aparta como evento "v1" desde día 1.
 *   3. Para que llegue por webhook, el SaaS suscribe el endpoint a esa kind en `webhook_endpoint.active_events`.
 *
 * Convención de naming: `<aggregate>.<verb>` o `<aggregate>.<state_change>`.
 * Subvariantes temporales (recordatorios T-7d/3d/1d) se modelan como kinds distintos
 * para facilitar suscripción granular por receptor.
 */
export const EVENT_KINDS = [
  'invoice.issued',
  'invoice.paid',
  'invoice.canceled',
  'subscription.created',
  'subscription.renewed',
  'subscription.past_due',
  'subscription.canceled',
  'subscription.paused',
  'subscription.resumed',
  'subscription.plan_changed',
  'subscription.renewal_due_7d',
  'subscription.renewal_due_3d',
  'subscription.renewal_due_1d',
  'subscription.trial_ending_7d',
  'subscription.trial_ending_3d',
  'subscription.trial_ending_1d',
  'subscription.trial_ended',
  'payment.succeeded',
  'payment.failed',
  'customer.updated',
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export const AGGREGATE_TYPES = ['subscription', 'invoice', 'payment', 'customer'] as const;
export type AggregateType = (typeof AGGREGATE_TYPES)[number];

/**
 * `webhook_endpoint` puede suscribirse a estos targets via `target_type` en outbox_delivery.
 * Internal subscribers (email, métricas) viven detrás de `internal_handler` con un
 * `target_descriptor` que nombra el handler concreto (ej. `renewal_reminder_email`).
 */
export const TARGET_TYPES = ['webhook_endpoint', 'internal_handler'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export const DELIVERY_STATUSES = ['pending', 'delivering', 'delivered', 'giving_up'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
