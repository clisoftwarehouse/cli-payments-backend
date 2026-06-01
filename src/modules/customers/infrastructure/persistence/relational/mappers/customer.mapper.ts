import { CustomerEntity } from '../entities/customer.entity';
import { Customer, IdentityType } from '../../../../domain/customer';

export class CustomerMapper {
  static toDomain(raw: CustomerEntity): Customer {
    const d = new Customer();
    d.id = raw.id;
    d.email = raw.email;
    d.fullName = raw.fullName;
    d.phone = raw.phone;
    d.country = raw.country;
    d.identityType = raw.identityType as IdentityType | null;
    d.identityValue = raw.identityValue;
    d.legalName = raw.legalName;
    d.address = raw.address;
    d.defaultLocale = raw.defaultLocale;
    d.createdAt = raw.createdAt;
    d.updatedAt = raw.updatedAt;
    return d;
  }

  static toPersistence(d: Partial<Customer>): Partial<CustomerEntity> {
    const e: Partial<CustomerEntity> = {};
    if (d.email !== undefined) e.email = d.email;
    if (d.fullName !== undefined) e.fullName = d.fullName;
    if (d.phone !== undefined) e.phone = d.phone;
    if (d.country !== undefined) e.country = d.country;
    if (d.identityType !== undefined) e.identityType = d.identityType;
    if (d.identityValue !== undefined) e.identityValue = d.identityValue;
    if (d.legalName !== undefined) e.legalName = d.legalName;
    if (d.address !== undefined) e.address = d.address;
    if (d.defaultLocale !== undefined) e.defaultLocale = d.defaultLocale;
    return e;
  }
}
