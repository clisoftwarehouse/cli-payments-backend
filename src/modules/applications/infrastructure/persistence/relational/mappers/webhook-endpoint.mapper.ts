import { WebhookEndpoint } from '../../../../domain/webhook-endpoint';
import { WebhookEndpointEntity } from '../entities/webhook-endpoint.entity';

export class WebhookEndpointMapper {
  static toDomain(raw: WebhookEndpointEntity): WebhookEndpoint {
    const domain = new WebhookEndpoint();
    domain.id = raw.id;
    domain.applicationId = raw.applicationId;
    domain.url = raw.url;
    domain.activeEvents = raw.activeEvents ?? [];
    domain.isActive = raw.isActive;
    domain.createdAt = raw.createdAt;
    domain.updatedAt = raw.updatedAt;
    return domain;
  }
}
