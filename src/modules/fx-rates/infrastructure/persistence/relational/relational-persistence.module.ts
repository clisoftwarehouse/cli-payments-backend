import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FxRateEntity } from './entities/fx-rate.entity';
import { FxRateRepository } from '../fx-rate.repository';
import { FxRateRelationalRepository } from './repositories/fx-rate.repository';

@Module({
  imports: [TypeOrmModule.forFeature([FxRateEntity])],
  providers: [
    {
      provide: FxRateRepository,
      useClass: FxRateRelationalRepository,
    },
  ],
  exports: [FxRateRepository],
})
export class RelationalFxRatePersistenceModule {}
