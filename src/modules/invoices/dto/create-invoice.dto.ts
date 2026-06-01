import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
  IsIn,
  IsInt,
  IsUUID,
  IsArray,
  IsString,
  IsObject,
  IsOptional,
  ArrayNotEmpty,
  ValidateNested,
  IsNumberString,
} from 'class-validator';

import { DisplayCurrency } from '../domain/invoice';

export class CreateInvoiceItemDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: '15.00' })
  @IsNumberString({ no_symbols: false })
  unitAmountEur: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class CreateInvoiceDto {
  @ApiProperty()
  @IsUUID()
  applicationId: string;

  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiPropertyOptional({ enum: ['EUR', 'USD'], default: 'EUR' })
  @IsIn(['EUR', 'USD'])
  @IsOptional()
  displayCurrency?: DisplayCurrency = 'EUR';

  @ApiProperty({ type: [CreateInvoiceItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
