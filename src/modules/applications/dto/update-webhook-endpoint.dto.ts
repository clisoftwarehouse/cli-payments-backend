import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

import { CreateWebhookEndpointDto } from './create-webhook-endpoint.dto';

export class UpdateWebhookEndpointDto extends PartialType(CreateWebhookEndpointDto) {
  @ApiPropertyOptional({ example: false, description: 'Activar/desactivar el endpoint sin borrarlo.' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
