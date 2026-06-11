import { createHash, randomBytes } from 'crypto';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';

import { Application } from './domain/application';
import { ApiKeyWithSecret } from './domain/api-key';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { WebhookEndpointWithSecret } from './domain/webhook-endpoint';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';
import { ApplicationRepository } from './infrastructure/persistence/application.repository';

@Injectable()
export class ApplicationsService {
  constructor(private readonly applicationsRepository: ApplicationRepository) {}

  async create(dto: CreateApplicationDto): Promise<Application> {
    const existing = await this.applicationsRepository.findBySlug(dto.slug);
    if (existing) throw new ConflictException(`Application slug "${dto.slug}" ya existe.`);

    return this.applicationsRepository.create({
      slug: dto.slug,
      name: dto.name,
      mode: dto.mode ?? 'live',
      isActive: true,
      websiteUrl: dto.websiteUrl ?? null,
      contactEmail: dto.contactEmail ?? null,
    });
  }

  async update(id: string, dto: UpdateApplicationDto): Promise<Application> {
    return this.applicationsRepository.update(id, {
      ...dto,
      websiteUrl: dto.websiteUrl ?? undefined,
      contactEmail: dto.contactEmail ?? undefined,
    });
  }

  async findById(id: string): Promise<Application> {
    const app = await this.applicationsRepository.findById(id);
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  list(opts: IPaginationOptions): Promise<Application[]> {
    return this.applicationsRepository.findMany(opts);
  }

  async findBySlug(slug: string): Promise<Application | null> {
    return this.applicationsRepository.findBySlug(slug);
  }

  async createApiKey(applicationId: string, dto: CreateApiKeyDto): Promise<ApiKeyWithSecret> {
    await this.findById(applicationId);

    const app = await this.applicationsRepository.findById(applicationId);
    const prefix = app!.mode === 'live' ? 'pk_live_' : 'pk_test_';
    const secretPrefix = app!.mode === 'live' ? 'sk_live_' : 'sk_test_';

    const publicId = `${prefix}${randomBytes(12).toString('hex')}`;
    const secretPlain = `${secretPrefix}${randomBytes(24).toString('hex')}`;
    const secretHash = createHash('sha256').update(secretPlain).digest('hex');

    const created = await this.applicationsRepository.createApiKey({
      applicationId,
      publicId,
      secretHash,
      label: dto.label,
      scopes: dto.scopes,
    });

    return { ...created, secret: secretPlain };
  }

  listApiKeys(applicationId: string) {
    return this.applicationsRepository.findApiKeysByApplication(applicationId);
  }

  revokeApiKey(id: string): Promise<void> {
    return this.applicationsRepository.revokeApiKey(id);
  }

  async createWebhookEndpoint(
    applicationId: string,
    dto: CreateWebhookEndpointDto,
  ): Promise<WebhookEndpointWithSecret> {
    await this.findById(applicationId);

    const signingSecret = `whsec_${randomBytes(24).toString('hex')}`;
    const created = await this.applicationsRepository.createWebhookEndpoint({
      applicationId,
      url: dto.url,
      signingSecret,
      activeEvents: dto.activeEvents,
    });

    return { ...created, signingSecret };
  }

  listWebhookEndpoints(applicationId: string) {
    return this.applicationsRepository.findWebhookEndpointsByApplication(applicationId);
  }

  updateWebhookEndpoint(id: string, dto: UpdateWebhookEndpointDto) {
    return this.applicationsRepository.updateWebhookEndpoint(id, dto);
  }
}
