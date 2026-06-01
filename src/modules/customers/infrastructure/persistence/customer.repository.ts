import { Customer } from '../../domain/customer';
import { NullableType } from '@/common/utils/types/nullable.type';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';

export abstract class CustomerRepository {
  abstract create(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer>;
  abstract update(id: string, payload: Partial<Customer>): Promise<Customer>;
  abstract findById(id: string): Promise<NullableType<Customer>>;
  abstract findByEmailAndCountry(email: string, country: string): Promise<NullableType<Customer>>;
  abstract findMany(opts: IPaginationOptions & { search?: string }): Promise<Customer[]>;
}
