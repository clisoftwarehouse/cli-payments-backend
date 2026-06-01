import { Bank } from '../../../../domain/bank';
import { BankEntity } from '../entities/bank.entity';

export class BankMapper {
  static toDomain(raw: BankEntity): Bank {
    const domain = new Bank();
    domain.id = raw.id;
    domain.ibpCode = raw.ibpCode;
    domain.name = raw.name;
    domain.shortName = raw.shortName;
    domain.c2pEnabled = raw.c2pEnabled;
    domain.transferEnabled = raw.transferEnabled;
    domain.isActive = raw.isActive;
    domain.createdAt = raw.createdAt;
    domain.updatedAt = raw.updatedAt;
    return domain;
  }
}
