import { Module } from '@nestjs/common';

import { ApplicationsService } from './applications.service';
import { ApplicationsController } from './applications.controller';
import { RelationalApplicationPersistenceModule } from './infrastructure/persistence/relational/relational-persistence.module';

const infrastructurePersistenceModule = RelationalApplicationPersistenceModule;

@Module({
  imports: [infrastructurePersistenceModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService, infrastructurePersistenceModule],
})
export class ApplicationsModule {}
