import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, Matches, IsOptional } from 'class-validator';

import { FxCurrency } from '../domain/fx-rate';

export class GetLatestFxRateDto {
  @ApiPropertyOptional({ enum: ['EUR', 'USD'], default: 'EUR' })
  @IsIn(['EUR', 'USD'])
  @IsOptional()
  currency?: FxCurrency = 'EUR';
}

export class QueryFxRatesDto {
  @ApiPropertyOptional({ enum: ['EUR', 'USD'], default: 'EUR' })
  @IsIn(['EUR', 'USD'])
  @IsOptional()
  currency?: FxCurrency = 'EUR';

  @ApiPropertyOptional({ example: '2026-01-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from debe estar en formato YYYY-MM-DD' })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to debe estar en formato YYYY-MM-DD' })
  @IsOptional()
  to?: string;
}
