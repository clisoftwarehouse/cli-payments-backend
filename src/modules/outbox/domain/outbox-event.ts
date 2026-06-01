import { ApiProperty } from '@nestjs/swagger';

import { EventKind, AggregateType } from './event-kind';

export class OutboxEvent {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty({ enum: ['subscription', 'invoice', 'payment', 'customer'] })
  aggregateType: AggregateType;

  @ApiProperty()
  aggregateId: string;

  @ApiProperty()
  eventKind: EventKind;

  /**
   * Clave semántica única: `<aggregate_id>.<event_kind>.<discriminator>`.
   * Discriminator depende del kind: fecha para reminders, periodStart para renewals,
   * paymentId para invoice.paid. Garantiza que el mismo hecho de negocio no se
   * inserte dos veces (UNIQUE en DB).
   */
  @ApiProperty()
  deliveryKey: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payload: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;
}
