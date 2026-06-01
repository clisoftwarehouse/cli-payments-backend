import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BankEntity } from './entities/bank.entity';
import { BankRepository } from '../bank.repository';
import { BanksRelationalRepository } from './repositories/bank.repository';

@Module({
  imports: [TypeOrmModule.forFeature([BankEntity])],
  providers: [
    {
      provide: BankRepository,
      useClass: BanksRelationalRepository,
    },
  ],
  exports: [BankRepository],
})
export class RelationalBankPersistenceModule {}
