import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { VENEZUELAN_BANKS } from './bank-seed.data';
import { BankEntity } from '@/modules/banks/infrastructure/persistence/relational/entities/bank.entity';

@Injectable()
export class BankSeedService {
  constructor(
    @InjectRepository(BankEntity)
    private readonly repository: Repository<BankEntity>,
  ) {}

  async run(): Promise<void> {
    for (const seed of VENEZUELAN_BANKS) {
      const existing = await this.repository.findOne({ where: { ibpCode: seed.ibpCode } });
      if (existing) continue;

      await this.repository.save(
        this.repository.create({
          ibpCode: seed.ibpCode,
          name: seed.name,
          shortName: seed.shortName,
          c2pEnabled: seed.c2pEnabled,
          transferEnabled: seed.transferEnabled,
          isActive: true,
        }),
      );
    }
  }
}
