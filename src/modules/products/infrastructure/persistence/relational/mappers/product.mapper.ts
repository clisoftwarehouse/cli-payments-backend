import { ProductEntity } from '../entities/product.entity';
import { Product, ProductKind, PriceCurrency, BillingInterval } from '../../../../domain/product';

export class ProductMapper {
  static toDomain(raw: ProductEntity): Product {
    const d = new Product();
    d.id = raw.id;
    d.sku = raw.sku;
    d.name = raw.name;
    d.description = raw.description;
    d.kind = raw.kind as ProductKind;
    d.priceCurrency = raw.priceCurrency as PriceCurrency;
    d.priceAmount = raw.priceAmount;
    d.billingInterval = (raw.billingInterval as BillingInterval) ?? null;
    d.isActive = raw.isActive;
    d.planFeatures = raw.planFeatures;
    d.applicationId = raw.applicationId;
    d.createdAt = raw.createdAt;
    d.updatedAt = raw.updatedAt;
    return d;
  }

  static toPersistence(d: Partial<Product>): Partial<ProductEntity> {
    const e: Partial<ProductEntity> = {};
    if (d.sku !== undefined) e.sku = d.sku;
    if (d.name !== undefined) e.name = d.name;
    if (d.description !== undefined) e.description = d.description;
    if (d.kind !== undefined) e.kind = d.kind;
    if (d.priceCurrency !== undefined) e.priceCurrency = d.priceCurrency;
    if (d.priceAmount !== undefined) e.priceAmount = d.priceAmount;
    if (d.billingInterval !== undefined) e.billingInterval = d.billingInterval;
    if (d.isActive !== undefined) e.isActive = d.isActive;
    if (d.planFeatures !== undefined) e.planFeatures = d.planFeatures;
    if (d.applicationId !== undefined) e.applicationId = d.applicationId;
    return e;
  }
}
