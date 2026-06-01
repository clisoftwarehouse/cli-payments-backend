import { ILike, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { Customer } from '../../../../domain/customer';
import { CustomerMapper } from '../mappers/customer.mapper';
import { CustomerEntity } from '../entities/customer.entity';
import { CustomerRepository } from '../../customer.repository';
import { NullableType } from '@/common/utils/types/nullable.type';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';

@Injectable()
export class CustomersRelationalRepository implements CustomerRepository {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly repo: Repository<CustomerEntity>,
  ) {}

  async create(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const created = await this.repo.save(this.repo.create(CustomerMapper.toPersistence(data)));
    return CustomerMapper.toDomain(created);
  }

  async update(id: string, payload: Partial<Customer>): Promise<Customer> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Customer not found');
    Object.assign(entity, CustomerMapper.toPersistence(payload));
    const saved = await this.repo.save(entity);
    return CustomerMapper.toDomain(saved);
  }

  async findById(id: string): Promise<NullableType<Customer>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? CustomerMapper.toDomain(entity) : null;
  }

  async findByEmailAndCountry(email: string, country: string): Promise<NullableType<Customer>> {
    const entity = await this.repo.findOne({ where: { email, country } });
    return entity ? CustomerMapper.toDomain(entity) : null;
  }

  async findMany(opts: IPaginationOptions & { search?: string }): Promise<Customer[]> {
    const where = opts.search ? [{ email: ILike(`%${opts.search}%`) }, { fullName: ILike(`%${opts.search}%`) }] : {};
    const entities = await this.repo.find({
      where,
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      order: { createdAt: 'DESC' },
    });
    return entities.map(CustomerMapper.toDomain);
  }
}
