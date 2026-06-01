import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProductEntity } from './entities/product.entity';
import { ProductRepository } from '../product.repository';
import { ProductsRelationalRepository } from './repositories/product.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity])],
  providers: [{ provide: ProductRepository, useClass: ProductsRelationalRepository }],
  exports: [ProductRepository],
})
export class RelationalProductPersistenceModule {}
