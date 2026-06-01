import { EntityManager } from 'typeorm';
import { Logger, Injectable } from '@nestjs/common';

import { OutboxFanoutService } from './outbox-fanout.service';
import { AppendEventInput, AppendEventResult } from './dto/append-event.input';
import { OutboxEventEntity } from './infrastructure/persistence/relational/entities/outbox-event.entity';
import { OutboxDeliveryEntity } from './infrastructure/persistence/relational/entities/outbox-delivery.entity';

/**
 * Append-only de eventos de dominio que cruzan procesos (webhooks salientes, emails).
 *
 * Contrato:
 * 1. Se llama DENTRO de la transacción que persiste el cambio de estado.
 *    El caller pasa el `EntityManager` transaccional.
 * 2. Idempotente por `delivery_key`. Si el key ya existe, no inserta nada nuevo
 *    y devuelve `deduplicated: true`.
 * 3. Crea las `outbox_delivery` rows en la misma TX (fanout eager) — el dispatcher
 *    luego procesa cada delivery independientemente.
 * 4. Devuelve los `deliveryIds` para que el caller, DESPUÉS de commit, los encole
 *    en BullMQ vía `OutboxQueue.dispatchMany()`.
 */
@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly fanout: OutboxFanoutService) {}

  async append(em: EntityManager, input: AppendEventInput): Promise<AppendEventResult> {
    // 1. Intenta insertar el evento. Si delivery_key ya existe (UNIQUE), DO NOTHING.
    const insertResult = await em
      .createQueryBuilder()
      .insert()
      .into(OutboxEventEntity)
      .values({
        applicationId: input.applicationId,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventKind: input.eventKind,
        deliveryKey: input.deliveryKey,
        payload: input.payload as never, // TypeORM QueryDeepPartialEntity es muy estricto con jsonb<Record<string,unknown>>
      })
      .orIgnore('("delivery_key")')
      .execute();

    if (insertResult.identifiers.length === 0 || !insertResult.identifiers[0]?.id) {
      // Conflict — evento ya existía. No se crean deliveries nuevas.
      const existing = await em.findOne(OutboxEventEntity, {
        where: { deliveryKey: input.deliveryKey },
        select: { id: true },
      });
      if (!existing) {
        // Shouldn't happen — orIgnore implies the row exists, but defend anyway.
        throw new Error(`Outbox event conflict on delivery_key=${input.deliveryKey} but no existing row found.`);
      }
      this.logger.debug(`Outbox append deduplicated: ${input.deliveryKey}`);
      return { eventId: existing.id, deliveryIds: [], deduplicated: true };
    }

    const eventId = insertResult.identifiers[0].id as string;

    // 2. Fanout: a qué subscribers va este evento.
    const targets = await this.fanout.expand(em, {
      applicationId: input.applicationId,
      eventKind: input.eventKind,
      internalHandlers: input.internalHandlers,
    });

    if (targets.length === 0) {
      this.logger.debug(
        `Outbox event ${input.eventKind} para application ${input.applicationId} sin subscribers — solo se persiste el evento.`,
      );
      return { eventId, deliveryIds: [], deduplicated: false };
    }

    // 3. Crear deliveries en bulk (mismo TX).
    const now = new Date();
    const deliveryRows = targets.map((t) => ({
      eventId,
      targetType: t.targetType,
      targetId: t.targetId,
      targetDescriptor: t.targetDescriptor,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: now,
    }));

    const inserted = await em
      .createQueryBuilder()
      .insert()
      .into(OutboxDeliveryEntity)
      .values(deliveryRows)
      .execute();

    const deliveryIds = inserted.identifiers.map((i) => i.id as string);
    return { eventId, deliveryIds, deduplicated: false };
  }
}
