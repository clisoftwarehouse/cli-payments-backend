import { Module } from '@nestjs/common';

import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { SaasCustomersController } from './saas-customers.controller';
import { AuthApiKeyModule } from '@/modules/auth-api-key/auth-api-key.module';
import { RelationalCustomerPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalCustomerPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule, AuthApiKeyModule],
  controllers: [CustomersController, SaasCustomersController],
  providers: [CustomersService],
  exports: [CustomersService, infrastructurePersistenceModule],
})
export class CustomersModule {}
