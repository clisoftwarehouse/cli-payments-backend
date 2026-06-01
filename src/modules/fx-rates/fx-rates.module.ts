import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import fxConfig from './config/fx.config';
import { FxRatesCron } from './fx-rates.cron';
import { FxRatesService } from './fx-rates.service';
import { FxFetcherService } from './fx-fetcher.service';
import { FxRatesController } from './fx-rates.controller';
import { DolarApiAdapter } from './adapters/dolarapi.adapter';
import { YadioApiAdapter } from './adapters/yadio-api.adapter';
import { PublicFxRatesController } from './public-fx-rates.controller';
import { ExchangedynApiAdapter } from './adapters/exchangedyn-api.adapter';
import { RelationalFxRatePersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalFxRatePersistenceModule;

@Module({
  imports: [ConfigModule.forFeature(fxConfig), infrastructurePersistenceModule],
  controllers: [FxRatesController, PublicFxRatesController],
  providers: [DolarApiAdapter, YadioApiAdapter, ExchangedynApiAdapter, FxFetcherService, FxRatesService, FxRatesCron],
  exports: [FxRatesService, infrastructurePersistenceModule],
})
export class FxRatesModule {}
