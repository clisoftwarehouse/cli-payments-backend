import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsUUID, IsObject, IsString, MaxLength, IsBoolean, IsOptional } from 'class-validator';

import { BillingCycle } from '../domain/subscription';

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiPropertyOptional({ description: 'UUID del producto. Provee `productId` O `productSku`, no ambos.' })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description: 'SKU del producto (más fácil que el UUID). Ej: `vitriona-pro-monthly`. Alternativa a `productId`.',
    example: 'vitriona-pro-monthly',
  })
  @IsString()
  @MaxLength(80)
  @IsOptional()
  productSku?: string;

  @ApiProperty({ enum: ['monthly', 'annual'] })
  @IsIn(['monthly', 'annual'])
  billingCycle: BillingCycle;

  @ApiPropertyOptional({ description: 'Si true, arranca como trialing (sin Invoice inicial). Default: false.' })
  @IsBoolean()
  @IsOptional()
  startAsTrial?: boolean;

  @ApiPropertyOptional({ description: 'ID del registro equivalente del SaaS (ej: businessId en Vitriona).' })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  externalSubscriptionId?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
