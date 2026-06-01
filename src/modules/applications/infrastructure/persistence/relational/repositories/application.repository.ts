import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { ApiKey } from '../../../../domain/api-key';
import { ApiKeyMapper } from '../mappers/api-key.mapper';
import { ApiKeyEntity } from '../entities/api-key.entity';
import { Application } from '../../../../domain/application';
import { ApplicationMapper } from '../mappers/application.mapper';
import { NullableType } from '@/common/utils/types/nullable.type';
import { ApplicationEntity } from '../entities/application.entity';
import { ApplicationRepository } from '../../application.repository';
import { WebhookEndpoint } from '../../../../domain/webhook-endpoint';
import { WebhookEndpointMapper } from '../mappers/webhook-endpoint.mapper';
import { WebhookEndpointEntity } from '../entities/webhook-endpoint.entity';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';

@Injectable()
export class ApplicationsRelationalRepository implements ApplicationRepository {
  constructor(
    @InjectRepository(ApplicationEntity)
    private readonly appRepo: Repository<ApplicationEntity>,
    @InjectRepository(ApiKeyEntity)
    private readonly keyRepo: Repository<ApiKeyEntity>,
    @InjectRepository(WebhookEndpointEntity)
    private readonly hookRepo: Repository<WebhookEndpointEntity>,
  ) {}

  async create(data: Omit<Application, 'id' | 'createdAt' | 'updatedAt'>): Promise<Application> {
    const created = await this.appRepo.save(this.appRepo.create(ApplicationMapper.toPersistence(data)));
    return ApplicationMapper.toDomain(created);
  }

  async update(id: string, payload: Partial<Application>): Promise<Application> {
    const entity = await this.appRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Application not found');
    Object.assign(entity, ApplicationMapper.toPersistence(payload));
    const saved = await this.appRepo.save(entity);
    return ApplicationMapper.toDomain(saved);
  }

  async findById(id: string): Promise<NullableType<Application>> {
    const entity = await this.appRepo.findOne({ where: { id } });
    return entity ? ApplicationMapper.toDomain(entity) : null;
  }

  async findBySlug(slug: string): Promise<NullableType<Application>> {
    const entity = await this.appRepo.findOne({ where: { slug } });
    return entity ? ApplicationMapper.toDomain(entity) : null;
  }

  async findMany(opts: IPaginationOptions): Promise<Application[]> {
    const entities = await this.appRepo.find({
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      order: { createdAt: 'DESC' },
    });
    return entities.map(ApplicationMapper.toDomain);
  }

  async createApiKey(input: {
    applicationId: string;
    publicId: string;
    secretHash: string;
    label: string;
    scopes: string[];
  }): Promise<ApiKey> {
    const created = await this.keyRepo.save(this.keyRepo.create(input));
    return ApiKeyMapper.toDomain(created);
  }

  async findApiKeysByApplication(applicationId: string): Promise<ApiKey[]> {
    const entities = await this.keyRepo.find({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });
    return entities.map(ApiKeyMapper.toDomain);
  }

  async findApiKeyByPublicId(publicId: string): Promise<NullableType<ApiKey & { secretHash: string }>> {
    const entity = await this.keyRepo.findOne({ where: { publicId } });
    if (!entity) return null;
    return { ...ApiKeyMapper.toDomain(entity), secretHash: entity.secretHash };
  }

  async revokeApiKey(id: string): Promise<void> {
    await this.keyRepo.update(id, { revokedAt: new Date() });
  }

  async touchApiKey(id: string): Promise<void> {
    await this.keyRepo.update(id, { lastUsedAt: new Date() });
  }

  async createWebhookEndpoint(input: {
    applicationId: string;
    url: string;
    signingSecret: string;
    activeEvents: string[];
  }): Promise<WebhookEndpoint> {
    const created = await this.hookRepo.save(this.hookRepo.create(input));
    return WebhookEndpointMapper.toDomain(created);
  }

  async findWebhookEndpointsByApplication(applicationId: string): Promise<WebhookEndpoint[]> {
    const entities = await this.hookRepo.find({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });
    return entities.map(WebhookEndpointMapper.toDomain);
  }

  async updateWebhookEndpoint(
    id: string,
    payload: Partial<{ url: string; activeEvents: string[]; isActive: boolean }>,
  ): Promise<WebhookEndpoint> {
    const entity = await this.hookRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Webhook endpoint not found');
    Object.assign(entity, payload);
    const saved = await this.hookRepo.save(entity);
    return WebhookEndpointMapper.toDomain(saved);
  }
}
