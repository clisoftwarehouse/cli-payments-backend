import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    description: 'Si true (default), cancela al fin del período (mantiene acceso). Si false, cancelación inmediata.',
  })
  @IsBoolean()
  @IsOptional()
  atPeriodEnd?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}
