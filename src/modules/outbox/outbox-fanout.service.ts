import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { TargetType, EventKind } from './domain/event-kind';
import { WebhookEndpointEntity } from '@/modules/applications/infrastructure/persistence/relational/entities/webhook-endpoint.entity';

export type FanoutTarget = {
  targetType: TargetType;
  targetId: string | null;
  targetDescriptor: string | null;
};

export type FanoutInput = {
  applicationId: string;
  eventKind: EventKind;
  internalHandlers?: string[];
};

/**
 * Resuelve, dado un evento de outbox, qué deliveries deben crearse.
 *
 * Dos categorías de targets:
 * - **Webhook endpoints** suscritos al `event_kind` en `webhook_endpoint.active_events`
 *   y activos (`is_active = true`).
 * - **Internal handlers** pasados por el caller via `internalHandlers` (descriptors).
 *
 * Se ejecuta dentro de la misma transacción que `OutboxService.append()` para que
 * la lectura de webhook_endpoint sea consistente con el evento que se está insertando.
 */
@Injectable()
export class OutboxFanoutService {
  async expand(em: EntityManager, input: FanoutInput): Promise<FanoutTarget[]> {
    const targets: FanoutTarget[] = [];

    const endpoints = await em
      .createQueryBuilder(WebhookEndpointEntity, 'we')
      .where('we.application_id = :appId', { appId: input.applicationId })
      .andWhere('we.is_active = true')
      .andWhere(':kind = ANY(we.active_events)', { kind: input.eventKind })
      .getMany();

    for (const ep of endpoints) {
      targets.push({ targetType: 'webhook_endpoint', targetId: ep.id, targetDescriptor: null });
    }

    for (const descriptor of input.internalHandlers ?? []) {
      targets.push({ targetType: 'internal_handler', targetId: null, targetDescriptor: descriptor });
    }

    return targets;
  }
}
