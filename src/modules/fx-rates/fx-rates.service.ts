import { ConfigService } from '@nestjs/config';
import { Injectable, NotFoundException } from '@nestjs/common';

import { FxConfig } from './config/fx-config.type';
import { AllConfigType } from '@/config/config.type';
import { FxRate, FxCurrency } from './domain/fx-rate';
import { FxFetcherService } from './fx-fetcher.service';
import { FxRateRepository } from './infrastructure/persistence/fx-rate.repository';

@Injectable()
export class FxRatesService {
  constructor(
    private readonly fxRateRepository: FxRateRepository,
    private readonly fxFetcher: FxFetcherService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async getLatest(currency: FxCurrency): Promise<FxRate> {
    const latest = await this.fxRateRepository.findLatest(currency);
    if (!latest) {
      throw new NotFoundException(`No hay tasa FX registrada para ${currency}.`);
    }
    return latest;
  }

  async getLatestSafe(currency: FxCurrency): Promise<FxRate | null> {
    return this.fxRateRepository.findLatest(currency);
  }

  async getHistory(currency: FxCurrency, from: string, to: string): Promise<FxRate[]> {
    return this.fxRateRepository.findHistory(currency, from, to);
  }

  async refreshNow(): Promise<{ currency: FxCurrency; rate: string | null; source: string | null }[]> {
    const results = await this.fxFetcher.refreshAll();
    return results.map((r) => ({
      currency: r.currency,
      rate: r.result?.rate ?? null,
      source: r.result?.source ?? null,
    }));
  }

  async isStale(currency: FxCurrency): Promise<{ stale: boolean; ageHours: number | null }> {
    const latest = await this.fxRateRepository.findLatest(currency);
    if (!latest) return { stale: true, ageHours: null };

    const threshold = this.configService.getOrThrow<FxConfig>('fx', { infer: true }).staleHoursAlert;
    const ageHours = (Date.now() - new Date(latest.fetchedAt).getTime()) / 1000 / 60 / 60;
    return { stale: ageHours > threshold, ageHours };
  }
}
