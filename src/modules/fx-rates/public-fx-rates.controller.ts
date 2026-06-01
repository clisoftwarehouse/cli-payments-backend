import { Get, Query, Controller } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

import { FxRate } from './domain/fx-rate';
import { FxRatesService } from './fx-rates.service';
import { GetLatestFxRateDto } from './dto/query-fx-rates.dto';

@ApiTags('FX Rates (public)')
@Controller({ path: 'public/fx', version: '1' })
export class PublicFxRatesController {
  constructor(private readonly fxRatesService: FxRatesService) {}

  @ApiOperation({
    summary: 'Tasa actual EUR/USD → VES (consumido por landing y SaaS).',
    description: 'Endpoint público — devuelve la última tasa registrada. Cache recomendado: 5 minutos.',
  })
  @ApiOkResponse({ type: FxRate })
  @Get('latest')
  latest(@Query() dto: GetLatestFxRateDto): Promise<FxRate> {
    return this.fxRatesService.getLatest(dto.currency ?? 'EUR');
  }
}
