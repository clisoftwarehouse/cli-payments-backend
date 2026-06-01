import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsUUID, IsString, MaxLength, IsBoolean, IsOptional } from 'class-validator';

import { BillingCycle } from '../domain/subscription';

export class ChangePlanDto {
  @ApiPropertyOptional({ description: 'UUID del nuevo producto. Provee `productId` O `productSku`, no ambos.' })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description: 'SKU del nuevo producto (ej: `vitriona-business-monthly`). Alternativa a `productId`.',
    example: 'vitriona-business-monthly',
  })
  @IsString()
  @MaxLength(80)
  @IsOptional()
  productSku?: string;

  @ApiPropertyOptional({ enum: ['monthly', 'annual'] })
  @IsIn(['monthly', 'annual'])
  @IsOptional()
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({
    description:
      'Si true (default), aplica el cambio al fin del período actual. Si false, intenta aplicarlo inmediato (no genera invoice nuevo en este endpoint).',
  })
  @IsBoolean()
  @IsOptional()
  scheduleAtPeriodEnd?: boolean;
}
