import { FxRateEntity } from '../entities/fx-rate.entity';
import { FxRate, FxCurrency } from '../../../../domain/fx-rate';
import { FxSourceCode } from '../../../../config/fx-config.type';

export class FxRateMapper {
  static toDomain(raw: FxRateEntity): FxRate {
    const domain = new FxRate();
    domain.currency = raw.currency as FxCurrency;
    domain.rate = raw.rate;
    domain.source = raw.source as FxSourceCode;
    domain.effectiveDate = raw.effectiveDate;
    domain.fetchedAt = raw.fetchedAt;
    domain.createdAt = raw.createdAt;
    domain.updatedAt = raw.updatedAt;
    return domain;
  }

  static toPersistence(domain: Partial<FxRate>): Partial<FxRateEntity> {
    const entity: Partial<FxRateEntity> = {};
    if (domain.currency !== undefined) entity.currency = domain.currency;
    if (domain.rate !== undefined) entity.rate = domain.rate;
    if (domain.source !== undefined) entity.source = domain.source;
    if (domain.effectiveDate !== undefined) entity.effectiveDate = domain.effectiveDate;
    if (domain.fetchedAt !== undefined) entity.fetchedAt = domain.fetchedAt;
    return entity;
  }
}
