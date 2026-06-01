import { ConfigService } from '@nestjs/config';
import { Logger, Injectable } from '@nestjs/common';

import { FxCurrency } from './domain/fx-rate';
import { AllConfigType } from '@/config/config.type';
import { DolarApiAdapter } from './adapters/dolarapi.adapter';
import { YadioApiAdapter } from './adapters/yadio-api.adapter';
import { FxConfig, FxSourceCode } from './config/fx-config.type';
import { FxSourcePort, FxSourceResult } from './adapters/fx-source.port';
import { ExchangedynApiAdapter } from './adapters/exchangedyn-api.adapter';
import { FxRateRepository } from './infrastructure/persistence/fx-rate.repository';

@Injectable()
export class FxFetcherService {
  private readonly logger = new Logger(FxFetcherService.name);
  private readonly adapters: Map<FxSourceCode, FxSourcePort>;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly fxRateRepository: FxRateRepository,
    private readonly dolarApi: DolarApiAdapter,
    private readonly yadio: YadioApiAdapter,
    private readonly exchangedyn: ExchangedynApiAdapter,
  ) {
    this.adapters = new Map<FxSourceCode, FxSourcePort>([
      ['DOLARAPI', dolarApi],
      ['YADIO', yadio],
      ['EXCHANGEDYN', exchangedyn],
    ]);
  }

  async refreshAll(): Promise<Array<{ currency: FxCurrency; result: FxSourceResult | null }>> {
    const currencies: FxCurrency[] = ['EUR', 'USD'];
    return Promise.all(
      currencies.map(async (currency) => ({
        currency,
        result: await this.fetchWithFallback(currency),
      })),
    );
  }

  async fetchWithFallback(currency: FxCurrency): Promise<FxSourceResult | null> {
    const fxConfig = this.configService.getOrThrow<FxConfig>('fx', { infer: true });
    const sources: FxSourceCode[] = [fxConfig.primarySource, ...fxConfig.fallbackSources];

    for (const code of sources) {
      const adapter = this.adapters.get(code);
      if (!adapter) {
        this.logger.warn(`FX adapter desconocido: ${code}`);
        continue;
      }

      try {
        const result = await adapter.fetch(currency);
        await this.fxRateRepository.upsert({
          currency: result.currency,
          rate: result.rate,
          source: result.source,
          effectiveDate: result.effectiveDate,
          fetchedAt: result.fetchedAt,
        });
        return result;
      } catch (err) {
        this.logger.warn(`FX source ${code} falló para ${currency}: ${(err as Error).message}`);
      }
    }

    this.logger.error(`Todas las fuentes FX fallaron para ${currency}.`);
    return null;
  }
}
