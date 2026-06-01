import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThan, Repository } from 'typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { NullableType } from '@/common/utils/types/nullable.type';
import { SubscriptionMapper } from '../mappers/subscription.mapper';
import { SubscriptionEntity } from '../entities/subscription.entity';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';
import { SubscriptionEventEntity } from '../entities/subscription-event.entity';
import { Subscription, SubscriptionEvent } from '../../../../domain/subscription';
import { SubscriptionRepository, SubscriptionEventInput, SubscriptionCreateInput } from '../../subscription.repository';

@Injectable()
export class SubscriptionsRelationalRepository implements SubscriptionRepository {
  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly repo: Repository<SubscriptionEntity>,
    @InjectRepository(SubscriptionEventEntity)
    private readonly eventsRepo: Repository<SubscriptionEventEntity>,
  ) {}

  async create(data: SubscriptionCreateInput): Promise<Subscription> {
    const created = await this.repo.save(this.repo.create(data));
    return SubscriptionMapper.toDomain(created);
  }

  async update(id: string, payload: Partial<Subscription>): Promise<Subscription> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Subscription not found');

    if (payload.status !== undefined) entity.status = payload.status;
    if (payload.billingCycle !== undefined) entity.billingCycle = payload.billingCycle;
    if (payload.productId !== undefined) entity.productId = payload.productId;
    if (payload.currentPeriodStart !== undefined) entity.currentPeriodStart = payload.currentPeriodStart;
    if (payload.currentPeriodEnd !== undefined) entity.currentPeriodEnd = payload.currentPeriodEnd;
    if (payload.gracePeriodUntil !== undefined) entity.gracePeriodUntil = payload.gracePeriodUntil;
    if (payload.scheduledProductId !== undefined) entity.scheduledProductId = payload.scheduledProductId;
    if (payload.scheduledBillingCycle !== undefined) entity.scheduledBillingCycle = payload.scheduledBillingCycle;
    if (payload.scheduledAt !== undefined) entity.scheduledAt = payload.scheduledAt;
    if (payload.trialEndsAt !== undefined) entity.trialEndsAt = payload.trialEndsAt;
    if (payload.canceledAt !== undefined) entity.canceledAt = payload.canceledAt;
    if (payload.cancelReason !== undefined) entity.cancelReason = payload.cancelReason;
    if (payload.externalSubscriptionId !== undefined) entity.externalSubscriptionId = payload.externalSubscriptionId;
    if (payload.metadata !== undefined) entity.metadata = payload.metadata;

    const saved = await this.repo.save(entity);
    return SubscriptionMapper.toDomain(saved);
  }

  async findById(id: string): Promise<NullableType<Subscription>> {
    const e = await this.repo.findOne({ where: { id } });
    return e ? SubscriptionMapper.toDomain(e) : null;
  }

  async findByExternalId(applicationId: string, externalId: string): Promise<NullableType<Subscription>> {
    const e = await this.repo.findOne({ where: { applicationId, externalSubscriptionId: externalId } });
    return e ? SubscriptionMapper.toDomain(e) : null;
  }

  async findMany(
    opts: IPaginationOptions & { applicationId?: string; customerId?: string; status?: string },
  ): Promise<Subscription[]> {
    const where: Record<string, unknown> = {};
    if (opts.applicationId) where.applicationId = opts.applicationId;
    if (opts.customerId) where.customerId = opts.customerId;
    if (opts.status) where.status = opts.status;

    const entities = await this.repo.find({
      where,
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      order: { createdAt: 'DESC' },
    });
    return entities.map(SubscriptionMapper.toDomain);
  }

  async findEndingBetween(start: Date, end: Date, status: string): Promise<Subscription[]> {
    const entities = await this.repo.find({
      where: { status, currentPeriodEnd: Between(start, end) },
    });
    return entities.map(SubscriptionMapper.toDomain);
  }

  async findExpiredGrace(now: Date): Promise<Subscription[]> {
    const entities = await this.repo
      .createQueryBuilder('s')
      .where('s.status = :status', { status: 'past_due' })
      .andWhere('s.grace_period_until IS NOT NULL')
      .andWhere('s.grace_period_until < :now', { now })
      .getMany();
    return entities.map(SubscriptionMapper.toDomain);
  }

  async findExpiringNow(now: Date): Promise<Subscription[]> {
    const entities = await this.repo.find({
      where: { status: 'active', currentPeriodEnd: LessThan(now) },
    });
    return entities.map(SubscriptionMapper.toDomain);
  }

  async recordEvent(event: SubscriptionEventInput): Promise<SubscriptionEvent> {
    const saved = await this.eventsRepo.save(this.eventsRepo.create(event));
    return SubscriptionMapper.eventToDomain(saved);
  }

  async listEvents(subscriptionId: string): Promise<SubscriptionEvent[]> {
    const entities = await this.eventsRepo.find({
      where: { subscriptionId },
      order: { createdAt: 'DESC' },
    });
    return entities.map(SubscriptionMapper.eventToDomain);
  }
}
