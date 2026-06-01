import { Injectable } from '@nestjs/common';
import { Between, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { FxRateMapper } from '../mappers/fx-rate.mapper';
import { FxRateEntity } from '../entities/fx-rate.entity';
import { FxRateRepository } from '../../fx-rate.repository';
import { FxRate, FxCurrency } from '../../../../domain/fx-rate';
import { NullableType } from '@/common/utils/types/nullable.type';

@Injectable()
export class FxRateRelationalRepository implements FxRateRepository {
  constructor(
    @InjectRepository(FxRateEntity)
    private readonly repository: Repository<FxRateEntity>,
  ) {}

  async upsert(data: Omit<FxRate, 'createdAt' | 'updatedAt'>): Promise<FxRate> {
    const persistence = FxRateMapper.toPersistence(data);
    const existing = await this.repository.findOne({
      where: { currency: data.currency, effectiveDate: data.effectiveDate },
    });

    if (existing) {
      const updated = await this.repository.save(this.repository.create({ ...existing, ...persistence }));
      return FxRateMapper.toDomain(updated);
    }

    const created = await this.repository.save(this.repository.create(persistence));
    return FxRateMapper.toDomain(created);
  }

  async findLatest(currency: FxCurrency): Promise<NullableType<FxRate>> {
    const entity = await this.repository.findOne({
      where: { currency },
      order: { effectiveDate: 'DESC' },
    });
    return entity ? FxRateMapper.toDomain(entity) : null;
  }

  async findByCurrencyAndDate(currency: FxCurrency, effectiveDate: string): Promise<NullableType<FxRate>> {
    const entity = await this.repository.findOne({ where: { currency, effectiveDate } });
    return entity ? FxRateMapper.toDomain(entity) : null;
  }

  async findHistory(currency: FxCurrency, from: string, to: string): Promise<FxRate[]> {
    const entities = await this.repository.find({
      where: { currency, effectiveDate: Between(from, to) },
      order: { effectiveDate: 'DESC' },
    });
    return entities.map((e) => FxRateMapper.toDomain(e));
  }
}
