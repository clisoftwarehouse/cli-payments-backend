import { Injectable } from '@nestjs/common';

import { Bank } from './domain/bank';
import { BankRepository } from './infrastructure/persistence/bank.repository';

@Injectable()
export class BanksService {
  constructor(private readonly banksRepository: BankRepository) {}

  list(): Promise<Bank[]> {
    return this.banksRepository.findAllActive();
  }
}
