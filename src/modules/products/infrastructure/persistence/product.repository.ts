import { Product } from '../../domain/product';
import { NullableType } from '@/common/utils/types/nullable.type';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';

export abstract class ProductRepository {
  abstract create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product>;
  abstract update(id: string, payload: Partial<Product>): Promise<Product>;
  abstract findById(id: string): Promise<NullableType<Product>>;
  abstract findBySku(sku: string): Promise<NullableType<Product>>;
  abstract findMany(opts: IPaginationOptions & { applicationId?: string }): Promise<Product[]>;
}
