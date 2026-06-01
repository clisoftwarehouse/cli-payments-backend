import { ApplicationEntity } from '../entities/application.entity';
import { Application, ApplicationMode } from '../../../../domain/application';

export class ApplicationMapper {
  static toDomain(raw: ApplicationEntity): Application {
    const domain = new Application();
    domain.id = raw.id;
    domain.slug = raw.slug;
    domain.name = raw.name;
    domain.mode = raw.mode as ApplicationMode;
    domain.isActive = raw.isActive;
    domain.websiteUrl = raw.websiteUrl;
    domain.contactEmail = raw.contactEmail;
    domain.createdAt = raw.createdAt;
    domain.updatedAt = raw.updatedAt;
    return domain;
  }

  static toPersistence(domain: Partial<Application>): Partial<ApplicationEntity> {
    const entity: Partial<ApplicationEntity> = {};
    if (domain.id !== undefined) entity.id = domain.id;
    if (domain.slug !== undefined) entity.slug = domain.slug;
    if (domain.name !== undefined) entity.name = domain.name;
    if (domain.mode !== undefined) entity.mode = domain.mode;
    if (domain.isActive !== undefined) entity.isActive = domain.isActive;
    if (domain.websiteUrl !== undefined) entity.websiteUrl = domain.websiteUrl;
    if (domain.contactEmail !== undefined) entity.contactEmail = domain.contactEmail;
    return entity;
  }
}
