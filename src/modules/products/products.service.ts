import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';

import { Product, ProductKind } from './domain/product';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';
import { ProductRepository } from './infrastructure/persistence/product.repository';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductRepository) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const existing = await this.productsRepository.findBySku(dto.sku);
    if (existing) throw new ConflictException(`Product sku "${dto.sku}" ya existe.`);

    return this.productsRepository.create({
      sku: dto.sku,
      name: dto.name,
      description: dto.description ?? null,
      kind: dto.kind,
      priceCurrency: dto.priceCurrency,
      priceAmount: dto.priceAmount,
      billingInterval: dto.billingInterval ?? null,
      isActive: dto.isActive ?? true,
      planFeatures: dto.planFeatures ?? null,
      applicationId: dto.applicationId ?? null,
    });
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    return this.productsRepository.update(id, dto as Partial<Product>);
  }

  async findById(id: string): Promise<Product> {
    const p = await this.productsRepository.findById(id);
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  list(opts: IPaginationOptions & { applicationId?: string }) {
    return this.productsRepository.findMany(opts);
  }

  async findBySku(sku: string): Promise<Product> {
    const p = await this.productsRepository.findBySku(sku);
    if (!p) throw new NotFoundException(`Product sku "${sku}" no encontrado.`);
    return p;
  }

  /** Lista de productos vendibles directamente desde la landing (sin subscription_plan). */
  async listPublicCatalog(applicationId: string, kinds?: ProductKind[]): Promise<Product[]> {
    const all = await this.productsRepository.findMany({ page: 1, limit: 100, applicationId });
    const allowed = new Set<ProductKind>(kinds ?? ['audit', 'maintenance', 'dev_project', 'one_shot', 'addon']);
    return all.filter((p) => p.isActive && allowed.has(p.kind));
  }
}
