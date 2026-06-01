import { Injectable, NotFoundException } from '@nestjs/common';

import { Customer } from './domain/customer';
import { UpsertCustomerDto } from './dto/upsert-customer.dto';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';
import { CustomerRepository } from './infrastructure/persistence/customer.repository';

@Injectable()
export class CustomersService {
  constructor(private readonly customersRepository: CustomerRepository) {}

  async upsert(dto: UpsertCustomerDto): Promise<Customer> {
    const country = dto.country ?? 'VE';
    const existing = await this.customersRepository.findByEmailAndCountry(dto.email, country);

    if (existing) {
      return this.customersRepository.update(existing.id, {
        fullName: dto.fullName,
        phone: dto.phone ?? existing.phone,
        identityType: dto.identityType ?? existing.identityType,
        identityValue: dto.identityValue ?? existing.identityValue,
        legalName: dto.legalName ?? existing.legalName,
        address: dto.address ?? existing.address,
        defaultLocale: dto.defaultLocale ?? existing.defaultLocale,
      });
    }

    return this.customersRepository.create({
      email: dto.email,
      fullName: dto.fullName,
      phone: dto.phone ?? null,
      country,
      identityType: dto.identityType ?? null,
      identityValue: dto.identityValue ?? null,
      legalName: dto.legalName ?? null,
      address: dto.address ?? null,
      defaultLocale: dto.defaultLocale ?? 'es',
    });
  }

  async findById(id: string): Promise<Customer> {
    const c = await this.customersRepository.findById(id);
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  list(opts: IPaginationOptions & { search?: string }) {
    return this.customersRepository.findMany(opts);
  }
}
