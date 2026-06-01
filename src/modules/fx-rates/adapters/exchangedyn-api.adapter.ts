import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Logger, Injectable } from '@nestjs/common';

import { FxCurrency } from '../domain/fx-rate';
import { FxConfig } from '../config/fx-config.type';
import { AllConfigType } from '@/config/config.type';
import { FxSourcePort, FxSourceResult } from './fx-source.port';

type ExchangedynResponse = {
  quotes?: { price?: number };
  price?: number;
};

@Injectable()
export class ExchangedynApiAdapter extends FxSourcePort {
  readonly code = 'EXCHANGEDYN' as const;
  private readonly logger = new Logger(ExchangedynApiAdapter.name);

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    super();
  }

  async fetch(currency: FxCurrency): Promise<FxSourceResult> {
    const baseUrl = this.configService.getOrThrow<FxConfig>('fx', { infer: true }).exchangedynUrl;
    const url = this.buildUrl(baseUrl, currency);

    const response = await axios.get<ExchangedynResponse>(url, { timeout: 15_000 });

    const rateRaw = response.data?.quotes?.price ?? response.data?.price;
    if (typeof rateRaw !== 'number' || !Number.isFinite(rateRaw) || rateRaw <= 0) {
      throw new Error(`ExchangeDyn: respuesta inválida para ${currency}: ${JSON.stringify(response.data)}`);
    }

    const rate = rateRaw.toFixed(4);
    this.logger.log(`ExchangeDyn ${currency} → ${rate} VES`);

    return {
      currency,
      rate,
      source: this.code,
      effectiveDate: this.todayCaracas(),
      fetchedAt: new Date(),
    };
  }

  private buildUrl(baseUrl: string, currency: FxCurrency): string {
    const pair = `${currency.toLowerCase()}ves`;
    return baseUrl.replace(/eurves|usdves/i, pair);
  }

  private todayCaracas(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
}
