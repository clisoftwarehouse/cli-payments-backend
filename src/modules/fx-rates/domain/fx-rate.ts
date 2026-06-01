import { ApiProperty } from '@nestjs/swagger';

import { FxSourceCode } from '../config/fx-config.type';

export type FxCurrency = 'EUR' | 'USD';

export class FxRate {
  @ApiProperty({ example: 'EUR', enum: ['EUR', 'USD'] })
  currency: FxCurrency;

  @ApiProperty({ example: '125.4500', description: 'Cuánto vale 1 unidad de currency en VES (bolívares).' })
  rate: string;

  @ApiProperty({ example: 'BCV', enum: ['BCV', 'YADIO', 'EXCHANGEDYN', 'MANUAL'] })
  source: FxSourceCode;

  @ApiProperty({ example: '2026-05-16', description: 'Fecha efectiva (YYYY-MM-DD, zona horaria America/Caracas).' })
  effectiveDate: string;

  @ApiProperty()
  fetchedAt: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
