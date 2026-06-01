import { Module } from '@nestjs/common';

import { BanksService } from './banks.service';
import { BanksController } from './banks.controller';
import { RelationalBankPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalBankPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [BanksController],
  providers: [BanksService],
  exports: [BanksService, infrastructurePersistenceModule],
})
export class BanksModule {}
