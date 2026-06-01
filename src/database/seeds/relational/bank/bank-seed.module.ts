import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BankSeedService } from './bank-seed.service';
import { BankEntity } from '@/modules/banks/infrastructure/persistence/relational/entities/bank.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BankEntity])],
  providers: [BankSeedService],
  exports: [BankSeedService],
})
export class BankSeedModule {}
