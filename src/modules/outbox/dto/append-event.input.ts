import { EventKind, AggregateType } from '../domain/event-kind';

/**
 * Input para `OutboxService.append()`.
 *
 * `deliveryKey` es la clave semántica única que evita doble-emisión. Patrón:
 *   - `inv_<id>.paid.<paymentId>` para invoice.paid
 *   - `sub_<id>.renewed.<periodStartIso>` para subscription.renewed
 *   - `sub_<id>.renewal_due_7d.<dateIso>` para reminders
 *   - `sub_<id>.canceled.<canceledAtIso>` para canceled
 *
 * Si el delivery_key ya existe en DB, el append se considera **deduplicado**
 * y NO se crean deliveries adicionales. Esto convierte la idempotencia en
 * una garantía del schema, no del caller.
 */
export type AppendEventInput = {
  applicationId: string;
  aggregateType: AggregateType;
  aggregateId: string;
  eventKind: EventKind;
  deliveryKey: string;
  payload: Record<string, unknown>;
  /**
   * Handlers internos a notificar (ej. `renewal_reminder_email`).
   * Webhook subscribers se resuelven automáticamente desde webhook_endpoint.
   */
  internalHandlers?: string[];
};

export type AppendEventResult = {
  eventId: string;
  deliveryIds: string[];
  /** `true` si el delivery_key ya existía → no se crearon deliveries nuevas. */
  deduplicated: boolean;
};
