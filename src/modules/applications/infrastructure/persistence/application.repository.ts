import { ApiKey } from '../../domain/api-key';
import { Application } from '../../domain/application';
import { WebhookEndpoint } from '../../domain/webhook-endpoint';
import { NullableType } from '@/common/utils/types/nullable.type';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';

export abstract class ApplicationRepository {
  abstract create(data: Omit<Application, 'id' | 'createdAt' | 'updatedAt'>): Promise<Application>;
  abstract update(id: string, payload: Partial<Application>): Promise<Application>;
  abstract findById(id: string): Promise<NullableType<Application>>;
  abstract findBySlug(slug: string): Promise<NullableType<Application>>;
  abstract findMany(opts: IPaginationOptions): Promise<Application[]>;

  abstract createApiKey(input: {
    applicationId: string;
    publicId: string;
    secretHash: string;
    label: string;
    scopes: string[];
  }): Promise<ApiKey>;
  abstract findApiKeysByApplication(applicationId: string): Promise<ApiKey[]>;
  abstract findApiKeyByPublicId(publicId: string): Promise<NullableType<ApiKey & { secretHash: string }>>;
  abstract revokeApiKey(id: string): Promise<void>;
  abstract touchApiKey(id: string): Promise<void>;

  abstract createWebhookEndpoint(input: {
    applicationId: string;
    url: string;
    signingSecret: string;
    activeEvents: string[];
  }): Promise<WebhookEndpoint>;
  abstract findWebhookEndpointsByApplication(applicationId: string): Promise<WebhookEndpoint[]>;
  abstract updateWebhookEndpoint(
    id: string,
    payload: Partial<{ url: string; activeEvents: string[]; isActive: boolean }>,
  ): Promise<WebhookEndpoint>;
}
