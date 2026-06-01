import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Logger, Injectable } from '@nestjs/common';

import { FxCurrency } from '../domain/fx-rate';
import { FxConfig } from '../config/fx-config.type';
import { AllConfigType } from '@/config/config.type';
import { FxSourcePort, FxSourceResult } from './fx-source.port';

type YadioResponse = {
  USD?: number;
  EUR?: number;
  BS?: number;
  base?: string;
  date?: string;
};

@Injectable()
export class YadioApiAdapter extends FxSourcePort {
  readonly code = 'YADIO' as const;
  private readonly logger = new Logger(YadioApiAdapter.name);

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    super();
  }

  async fetch(currency: FxCurrency): Promise<FxSourceResult> {
    const baseUrl = this.configService.getOrThrow<FxConfig>('fx', { infer: true }).yadioUrl;
    const url = baseUrl.endsWith('/') ? `${baseUrl}${currency}` : `${baseUrl}/${currency}`;

    const response = await axios.get<YadioResponse>(url, { timeout: 15_000 });

    const rateRaw = response.data?.[currency] ?? response.data?.BS;
    if (typeof rateRaw !== 'number' || !Number.isFinite(rateRaw) || rateRaw <= 0) {
      throw new Error(`Yadio: respuesta inválida para ${currency}: ${JSON.stringify(response.data)}`);
    }

    const rate = rateRaw.toFixed(4);
    this.logger.log(`Yadio ${currency} → ${rate} VES`);

    return {
      currency,
      rate,
      source: this.code,
      effectiveDate: this.todayCaracas(),
      fetchedAt: new Date(),
    };
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
