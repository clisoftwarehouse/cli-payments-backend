import { Module } from '@nestjs/common';

import { MerchantTerminalsService } from './merchant-terminals.service';
import { MerchantTerminalsController } from './merchant-terminals.controller';
import { RelationalMerchantTerminalPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalMerchantTerminalPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [MerchantTerminalsController],
  providers: [MerchantTerminalsService],
  exports: [MerchantTerminalsService, infrastructurePersistenceModule],
})
export class MerchantTerminalsModule {}
