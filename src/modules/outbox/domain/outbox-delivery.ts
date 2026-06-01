import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TargetType, DeliveryStatus } from './event-kind';

export class OutboxDelivery {
  @ApiProperty()
  id: string;

  @ApiProperty()
  eventId: string;

  @ApiProperty({ enum: ['webhook_endpoint', 'internal_handler'] })
  targetType: TargetType;

  @ApiPropertyOptional({ description: 'FK soft a webhook_endpoint cuando aplica.' })
  targetId: string | null;

  @ApiPropertyOptional({
    description: 'Identifica el handler interno cuando targetType=internal_handler (ej. `renewal_reminder_email`).',
  })
  targetDescriptor: string | null;

  @ApiProperty({ enum: ['pending', 'delivering', 'delivered', 'giving_up'] })
  status: DeliveryStatus;

  @ApiProperty()
  attempts: number;

  @ApiPropertyOptional()
  nextAttemptAt: Date | null;

  @ApiPropertyOptional()
  lastErrorCode: string | null;

  @ApiPropertyOptional()
  lastErrorMessage: string | null;

  @ApiPropertyOptional()
  lastResponseStatus: number | null;

  @ApiPropertyOptional()
  lastResponseBody: string | null;

  @ApiPropertyOptional()
  deliveredAt: Date | null;

  @ApiPropertyOptional()
  givenUpAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
