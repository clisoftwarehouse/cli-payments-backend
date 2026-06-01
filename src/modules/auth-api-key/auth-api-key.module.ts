import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { ApiKeyEntity } from '@/modules/applications/infrastructure/persistence/relational/entities/api-key.entity';

const typeOrmFeature = TypeOrmModule.forFeature([ApiKeyEntity]);

@Module({
  imports: [typeOrmFeature],
  providers: [ApiKeyAuthGuard],
  // Exportamos el feature TypeORM también — el guard se instancia en módulos consumidores
  // (ej. SubscriptionsModule) y necesita resolver `ApiKeyEntityRepository` en ese contexto.
  exports: [ApiKeyAuthGuard, typeOrmFeature],
})
export class AuthApiKeyModule {}
