import { OutboxEventEntity } from '../entities/outbox-event.entity';
import { OutboxEvent } from '../../../../domain/outbox-event';
import { OutboxDelivery } from '../../../../domain/outbox-delivery';
import { OutboxDeliveryEntity } from '../entities/outbox-delivery.entity';
import { EventKind, TargetType, AggregateType, DeliveryStatus } from '../../../../domain/event-kind';

export class OutboxMapper {
  static eventToDomain(e: OutboxEventEntity): OutboxEvent {
    const d = new OutboxEvent();
    d.id = e.id;
    d.applicationId = e.applicationId;
    d.aggregateType = e.aggregateType as AggregateType;
    d.aggregateId = e.aggregateId;
    d.eventKind = e.eventKind as EventKind;
    d.deliveryKey = e.deliveryKey;
    d.payload = e.payload;
    d.createdAt = e.createdAt;
    return d;
  }

  static deliveryToDomain(e: OutboxDeliveryEntity): OutboxDelivery {
    const d = new OutboxDelivery();
    d.id = e.id;
    d.eventId = e.eventId;
    d.targetType = e.targetType as TargetType;
    d.targetId = e.targetId;
    d.targetDescriptor = e.targetDescriptor;
    d.status = e.status as DeliveryStatus;
    d.attempts = e.attempts;
    d.nextAttemptAt = e.nextAttemptAt;
    d.lastErrorCode = e.lastErrorCode;
    d.lastErrorMessage = e.lastErrorMessage;
    d.lastResponseStatus = e.lastResponseStatus;
    d.lastResponseBody = e.lastResponseBody;
    d.deliveredAt = e.deliveredAt;
    d.givenUpAt = e.givenUpAt;
    d.createdAt = e.createdAt;
    d.updatedAt = e.updatedAt;
    return d;
  }
}
