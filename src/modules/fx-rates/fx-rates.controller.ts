import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { Get, Post, Query, HttpCode, UseGuards, Controller, HttpStatus } from '@nestjs/common';

import { FxRate } from './domain/fx-rate';
import { FxRatesService } from './fx-rates.service';
import { QueryFxRatesDto, GetLatestFxRateDto } from './dto/query-fx-rates.dto';

@ApiTags('FX Rates (admin)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'fx-rates', version: '1' })
export class FxRatesController {
  constructor(private readonly fxRatesService: FxRatesService) {}

  @ApiOperation({ summary: 'Tasa actual para una divisa (admin)' })
  @ApiOkResponse({ type: FxRate })
  @Get('latest')
  latest(@Query() dto: GetLatestFxRateDto): Promise<FxRate> {
    return this.fxRatesService.getLatest(dto.currency ?? 'EUR');
  }

  @ApiOperation({ summary: 'Histórico de tasas (admin)' })
  @ApiOkResponse({ type: FxRate, isArray: true })
  @Get()
  history(@Query() dto: QueryFxRatesDto): Promise<FxRate[]> {
    const from = dto.from ?? this.daysAgo(30);
    const to = dto.to ?? this.today();
    return this.fxRatesService.getHistory(dto.currency ?? 'EUR', from, to);
  }

  @ApiOperation({ summary: 'Forzar refresh inmediato de todas las fuentes FX (admin)' })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh() {
    return this.fxRatesService.refreshNow();
  }

  private today(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private daysAgo(days: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }
}
