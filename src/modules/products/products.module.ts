import { Module } from '@nestjs/common';

import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { RelationalProductPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalProductPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService, infrastructurePersistenceModule],
})
export class ProductsModule {}
