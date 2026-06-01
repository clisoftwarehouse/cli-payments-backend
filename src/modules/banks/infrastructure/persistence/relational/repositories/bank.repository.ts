import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Bank } from '../../../../domain/bank';
import { BankMapper } from '../mappers/bank.mapper';
import { BankEntity } from '../entities/bank.entity';
import { BankRepository } from '../../bank.repository';
import { NullableType } from '@/common/utils/types/nullable.type';

@Injectable()
export class BanksRelationalRepository implements BankRepository {
  constructor(
    @InjectRepository(BankEntity)
    private readonly repository: Repository<BankEntity>,
  ) {}

  async findAllActive(): Promise<Bank[]> {
    const entities = await this.repository.find({ where: { isActive: true }, order: { ibpCode: 'ASC' } });
    return entities.map((e) => BankMapper.toDomain(e));
  }

  async findByIbpCode(ibpCode: string): Promise<NullableType<Bank>> {
    const entity = await this.repository.findOne({ where: { ibpCode } });
    return entity ? BankMapper.toDomain(entity) : null;
  }
}
