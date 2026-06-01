import { ApiKey } from '../../../../domain/api-key';
import { ApiKeyEntity } from '../entities/api-key.entity';

export class ApiKeyMapper {
  static toDomain(raw: ApiKeyEntity): ApiKey {
    const domain = new ApiKey();
    domain.id = raw.id;
    domain.applicationId = raw.applicationId;
    domain.publicId = raw.publicId;
    domain.label = raw.label;
    domain.scopes = raw.scopes ?? [];
    domain.lastUsedAt = raw.lastUsedAt;
    domain.revokedAt = raw.revokedAt;
    domain.createdAt = raw.createdAt;
    domain.updatedAt = raw.updatedAt;
    return domain;
  }
}
