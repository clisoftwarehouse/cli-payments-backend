import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { Product } from '../../../../domain/product';
import { ProductMapper } from '../mappers/product.mapper';
import { ProductEntity } from '../entities/product.entity';
import { ProductRepository } from '../../product.repository';
import { NullableType } from '@/common/utils/types/nullable.type';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';

@Injectable()
export class ProductsRelationalRepository implements ProductRepository {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly repo: Repository<ProductEntity>,
  ) {}

  async create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const created = await this.repo.save(this.repo.create(ProductMapper.toPersistence(data)));
    return ProductMapper.toDomain(created);
  }

  async update(id: string, payload: Partial<Product>): Promise<Product> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Product not found');
    Object.assign(entity, ProductMapper.toPersistence(payload));
    const saved = await this.repo.save(entity);
    return ProductMapper.toDomain(saved);
  }

  async findById(id: string): Promise<NullableType<Product>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? ProductMapper.toDomain(entity) : null;
  }

  async findBySku(sku: string): Promise<NullableType<Product>> {
    const entity = await this.repo.findOne({ where: { sku } });
    return entity ? ProductMapper.toDomain(entity) : null;
  }

  async findMany(opts: IPaginationOptions & { applicationId?: string }): Promise<Product[]> {
    const entities = await this.repo.find({
      where: opts.applicationId ? { applicationId: opts.applicationId } : {},
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      order: { createdAt: 'DESC' },
    });
    return entities.map(ProductMapper.toDomain);
  }
}
