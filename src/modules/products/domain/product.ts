import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ProductKind = 'subscription_plan' | 'dev_project' | 'audit' | 'maintenance' | 'addon' | 'one_shot';
export type PriceCurrency = 'EUR' | 'USD';
export type BillingInterval = 'monthly' | 'annual' | null;

export class Product {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'vitriona-pro-monthly' })
  sku: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ enum: ['subscription_plan', 'dev_project', 'audit', 'maintenance', 'addon', 'one_shot'] })
  kind: ProductKind;

  @ApiProperty({ enum: ['EUR', 'USD'] })
  priceCurrency: PriceCurrency;

  @ApiProperty({ example: '15.00' })
  priceAmount: string;

  @ApiPropertyOptional({ enum: ['monthly', 'annual'], nullable: true })
  billingInterval: BillingInterval;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Solo aplica a kind=subscription_plan. JSON con límites/features.' })
  planFeatures: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true, description: 'Aplicación origen (si el producto es exclusivo de un SaaS).' })
  applicationId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
