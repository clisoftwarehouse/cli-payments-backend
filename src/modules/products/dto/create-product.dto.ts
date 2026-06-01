import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsUUID, IsString, IsObject, IsBoolean, MaxLength, IsOptional, IsNumberString } from 'class-validator';

import { ProductKind, PriceCurrency, BillingInterval } from '../domain/product';

export class CreateProductDto {
  @ApiProperty({ example: 'vitriona-pro-monthly' })
  @IsString()
  @MaxLength(80)
  sku: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: ['subscription_plan', 'dev_project', 'audit', 'maintenance', 'addon', 'one_shot'] })
  @IsIn(['subscription_plan', 'dev_project', 'audit', 'maintenance', 'addon', 'one_shot'])
  kind: ProductKind;

  @ApiProperty({ enum: ['EUR', 'USD'] })
  @IsIn(['EUR', 'USD'])
  priceCurrency: PriceCurrency;

  @ApiProperty({ example: '15.00', description: 'String para preservar precisión decimal.' })
  @IsNumberString({ no_symbols: false })
  priceAmount: string;

  @ApiPropertyOptional({ enum: ['monthly', 'annual'], nullable: true })
  @IsIn(['monthly', 'annual'])
  @IsOptional()
  billingInterval?: Exclude<BillingInterval, null>;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  planFeatures?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  applicationId?: string;
}
