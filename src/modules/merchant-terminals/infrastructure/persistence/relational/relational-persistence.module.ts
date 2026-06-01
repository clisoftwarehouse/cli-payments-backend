import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MerchantTerminalEntity } from './entities/merchant-terminal.entity';
import { MerchantTerminalRepository } from '../merchant-terminal.repository';
import { MerchantTerminalsRelationalRepository } from './repositories/merchant-terminal.repository';

@Module({
  imports: [TypeOrmModule.forFeature([MerchantTerminalEntity])],
  providers: [{ provide: MerchantTerminalRepository, useClass: MerchantTerminalsRelationalRepository }],
  exports: [MerchantTerminalRepository],
})
export class RelationalMerchantTerminalPersistenceModule {}
