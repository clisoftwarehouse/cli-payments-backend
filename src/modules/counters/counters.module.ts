import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CountersService } from './counters.service';
import { CounterEntity } from './infrastructure/persistence/relational/entities/counter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CounterEntity])],
  providers: [CountersService],
  exports: [CountersService],
})
export class CountersModule {}
