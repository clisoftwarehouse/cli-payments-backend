import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeyEntity } from './entities/api-key.entity';
import { ApplicationEntity } from './entities/application.entity';
import { ApplicationRepository } from '../application.repository';
import { WebhookEndpointEntity } from './entities/webhook-endpoint.entity';
import { ApplicationsRelationalRepository } from './repositories/application.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ApplicationEntity, ApiKeyEntity, WebhookEndpointEntity])],
  providers: [
    {
      provide: ApplicationRepository,
      useClass: ApplicationsRelationalRepository,
    },
  ],
  exports: [ApplicationRepository],
})
export class RelationalApplicationPersistenceModule {}
