import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Logger, Injectable } from '@nestjs/common';

import { FxCurrency } from '../domain/fx-rate';
import { FxConfig } from '../config/fx-config.type';
import { AllConfigType } from '@/config/config.type';
import { FxSourcePort, FxSourceResult } from './fx-source.port';

type DolarApiQuote = {
  moneda: 'USD' | 'EUR' | string;
  fuente: 'oficial' | 'paralelo' | string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
};

@Injectable()
export class DolarApiAdapter extends FxSourcePort {
  readonly code = 'DOLARAPI' as const;
  private readonly logger = new Logger(DolarApiAdapter.name);

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    super();
  }

  async fetch(currency: FxCurrency): Promise<FxSourceResult> {
    const baseUrl = this.configService.getOrThrow<FxConfig>('fx', { infer: true }).dolarApiUrl;
    const path = currency === 'EUR' ? 'euros/oficial' : 'dolares/oficial';
    const url = baseUrl.endsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;

    const response = await axios.get<DolarApiQuote>(url, {
      timeout: 15_000,
      headers: { 'User-Agent': 'cli-payments/1.0 (+https://clisoftwarehouse.com)' },
    });

    const promedio = response.data?.promedio;
    if (typeof promedio !== 'number' || !Number.isFinite(promedio) || promedio <= 0) {
      throw new Error(`DolarApi: respuesta inválida para ${currency}: ${JSON.stringify(response.data)}`);
    }

    const rate = promedio.toFixed(4);
    const effectiveDate = this.extractEffectiveDate(response.data.fechaActualizacion);

    this.logger.log(`DolarApi ${currency} (${response.data.fuente}) → ${rate} VES (efectiva ${effectiveDate})`);

    return {
      currency,
      rate,
      source: this.code,
      effectiveDate,
      fetchedAt: new Date(),
    };
  }

  private extractEffectiveDate(iso: string | undefined): string {
    const dateString = iso ?? new Date().toISOString();
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return this.todayCaracas();
    }
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
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
