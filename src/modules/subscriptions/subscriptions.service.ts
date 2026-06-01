import { DataSource, EntityManager } from 'typeorm';
import {
  Logger,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

import { ChangePlanDto } from './dto/change-plan.dto';
import { Invoice } from '@/modules/invoices/domain/invoice';
import { Product } from '@/modules/products/domain/product';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { InvoicesService } from '@/modules/invoices/invoices.service';
import { ProductsService } from '@/modules/products/products.service';
import { Subscription, SubscriptionStatus } from './domain/subscription';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';
import { OutboxService } from '@/modules/outbox/outbox.service';
import { OutboxQueue } from '@/modules/outbox/outbox-queue.service';
import { EventKind } from '@/modules/outbox/domain/event-kind';
import { SubscriptionRepository } from './infrastructure/persistence/subscription.repository';
import { SubscriptionEntity } from './infrastructure/persistence/relational/entities/subscription.entity';
import { SubscriptionEventEntity } from './infrastructure/persistence/relational/entities/subscription-event.entity';
import { SubscriptionMapper } from './infrastructure/persistence/relational/mappers/subscription.mapper';
import {
  apply as applyLifecycle,
  create as createLifecycle,
  computePeriodEnd,
  LifecycleEvent,
  LifecycleResult,
  LifecycleSuccess,
  ProductRef,
  SubscriptionState,
} from './domain/subscription-lifecycle';

const GRACE_PERIOD_DAYS = 5;

type TriggeredBy = 'cron' | 'admin' | 'customer' | 'system' | 'webhook';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly subscriptions: SubscriptionRepository,
    private readonly products: ProductsService,
    private readonly invoices: InvoicesService,
    private readonly outbox: OutboxService,
    private readonly outboxQueue: OutboxQueue,
  ) {}

  // ════════ SaaS-facing operations ════════════════════════════════════════

  async create(applicationId: string, dto: CreateSubscriptionDto): Promise<Subscription> {
    if (dto.externalSubscriptionId) {
      const existing = await this.subscriptions.findByExternalId(applicationId, dto.externalSubscriptionId);
      if (existing) {
        throw new ConflictException(
          `Ya existe una subscription para externalSubscriptionId=${dto.externalSubscriptionId}`,
        );
      }
    }

    const product = await this.resolveProduct(dto.productId, dto.productSku);
    if (product.kind !== 'subscription_plan') {
      throw new ConflictException(`El producto ${product.sku} no es un subscription_plan.`);
    }

    const now = new Date();
    const result = await this.dataSource.transaction(async (em) => {
      const subRepo = em.getRepository(SubscriptionEntity);

      // Construye el estado inicial via lifecycle.create — siempre 'trialing' (representa
      // "registrada, primer pago pendiente"). startAsTrial es informativo (mantiene trialEndsAt).
      const placeholderId = '00000000-0000-0000-0000-000000000000'; // delivery_key se reescribe abajo
      const lifecycleResult = createLifecycle(placeholderId, {
        at: now,
        product: { id: product.id, sku: product.sku },
        billingCycle: dto.billingCycle,
      });
      const success = this.expectSuccess(lifecycleResult);

      // Persist + obtener id real
      const entity = subRepo.create({
        applicationId,
        customerId: dto.customerId,
        productId: product.id,
        status: success.next.status,
        billingCycle: success.next.billingCycle,
        currentPeriodStart: success.next.currentPeriodStart,
        currentPeriodEnd: success.next.currentPeriodEnd,
        gracePeriodUntil: null,
        scheduledProductId: null,
        scheduledBillingCycle: null,
        scheduledAt: null,
        trialEndsAt: success.next.trialEndsAt,
        canceledAt: null,
        cancelReason: null,
        externalSubscriptionId: dto.externalSubscriptionId ?? null,
        metadata: dto.metadata ?? null,
      });
      const saved = await subRepo.save(entity);

      // Reemitir outbox events con el subscriptionId real
      const realResult = createLifecycle(saved.id, {
        at: now,
        product: { id: product.id, sku: product.sku },
        billingCycle: dto.billingCycle,
      });
      const realSuccess = this.expectSuccess(realResult);

      await this.recordAuditEvent(em, saved.id, 'created', null, saved.status as SubscriptionStatus, 'system', {
        productId: product.id,
        billingCycle: dto.billingCycle,
      });
      const deliveryIds = await this.appendOutboxEvents(em, applicationId, saved.id, realSuccess.emit);

      return { saved, deliveryIds };
    });

    await this.outboxQueue.dispatchMany(result.deliveryIds);
    return SubscriptionMapper.toDomain(result.saved);
  }

  /**
   * Crea Invoice para el próximo período. NO cambia subscription state — eso ocurre
   * cuando se reciba el pago vía `onRenewalPaid`.
   *
   * NOTA sobre atomicidad: la creación del Invoice (`createDraft` + `issue`) NO
   * está envuelta en la misma TX que el audit event, porque `issue()` asigna un
   * número correlativo via `counters.next()` que hace su propia transacción (lock
   * pesado en counters), y meter eso dentro de otra TX puede causar deadlocks.
   * La consecuencia: si el audit event falla, el invoice ya quedó issued.
   * Aceptable — el invoice es la fuente de verdad de "se le pidió pagar".
   */
  async renew(
    id: string,
    triggeredBy: TriggeredBy = 'system',
  ): Promise<{ subscription: Subscription; invoice: Invoice }> {
    const sub = await this.requireById(id);
    if (sub.status !== 'active' && sub.status !== 'trialing' && sub.status !== 'past_due') {
      throw new ConflictException(`Subscription en estado ${sub.status} no se puede renovar.`);
    }

    const productId = sub.scheduledProductId ?? sub.productId;
    const billingCycle = sub.scheduledBillingCycle ?? sub.billingCycle;
    const product = await this.products.findById(productId);

    const isFirstPayment = sub.status === 'trialing';
    const nextStart = isFirstPayment ? sub.currentPeriodStart : sub.currentPeriodEnd;
    const nextEnd = isFirstPayment ? sub.currentPeriodEnd : computePeriodEnd(nextStart, billingCycle);

    const invoice = await this.invoices.createDraft({
      applicationId: sub.applicationId,
      customerId: sub.customerId,
      displayCurrency: product.priceCurrency,
      items: [
        {
          productId: product.id,
          description: `${product.name} — ${billingCycle === 'annual' ? 'Anual' : 'Mensual'}`,
          quantity: 1,
          unitAmountEur: product.priceAmount,
          metadata: {
            subscription_id: sub.id,
            period_start: nextStart.toISOString(),
            period_end: nextEnd.toISOString(),
          },
        },
      ],
    });

    const issued = await this.invoices.issue(invoice.id);

    await this.subscriptions.recordEvent({
      subscriptionId: sub.id,
      type: 'renewal_invoice_issued',
      triggeredBy,
      metadata: { invoice_id: issued.id, period_start: nextStart, period_end: nextEnd },
    });

    return { subscription: sub, invoice: issued };
  }

  /** Llamado cuando un Invoice de renovación se paga. */
  async onRenewalPaid(subscriptionId: string, invoiceId: string, paymentId?: string): Promise<Subscription> {
    return this.runLifecycleTransition(subscriptionId, 'webhook', (subEntity, product) =>
      applyLifecycle(
        subEntity.id,
        this.entityToState(subEntity, product),
        { kind: 'paid', at: new Date(), invoiceId, paymentId: paymentId ?? '' },
      ),
    );
  }

  async changePlan(id: string, dto: ChangePlanDto, triggeredBy: TriggeredBy): Promise<Subscription> {
    const product = await this.resolveProduct(dto.productId, dto.productSku);
    if (product.kind !== 'subscription_plan') {
      throw new ConflictException(`Producto ${product.sku} no es subscription_plan.`);
    }
    const scheduleAtPeriodEnd = dto.scheduleAtPeriodEnd ?? true;

    return this.runLifecycleTransition(id, triggeredBy, (subEntity) => {
      const productRef: ProductRef = { id: product.id, sku: product.sku };
      const billingCycle = dto.billingCycle ?? (subEntity.billingCycle as 'monthly' | 'annual');
      const state = this.entityToState(subEntity, product);
      return applyLifecycle(
        subEntity.id,
        state,
        scheduleAtPeriodEnd
          ? { kind: 'plan_schedule', at: new Date(), product: productRef, billingCycle }
          : { kind: 'plan_change_immediate', at: new Date(), product: productRef, billingCycle },
      );
    });
  }

  async cancel(id: string, dto: CancelSubscriptionDto, triggeredBy: TriggeredBy): Promise<Subscription> {
    const atPeriodEnd = dto.atPeriodEnd ?? true;
    return this.runLifecycleTransition(id, triggeredBy, (subEntity, product) =>
      applyLifecycle(subEntity.id, this.entityToState(subEntity, product), {
        kind: 'cancel',
        at: new Date(),
        immediate: !atPeriodEnd,
        reason: dto.reason ?? null,
      }),
    );
  }

  // ════════ Admin-only operations ═════════════════════════════════════════

  async pause(id: string, triggeredBy: TriggeredBy = 'admin'): Promise<Subscription> {
    return this.runLifecycleTransition(id, triggeredBy, (subEntity, product) =>
      applyLifecycle(subEntity.id, this.entityToState(subEntity, product), {
        kind: 'pause',
        at: new Date(),
      }),
    );
  }

  async resume(id: string, triggeredBy: TriggeredBy = 'admin'): Promise<Subscription> {
    return this.runLifecycleTransition(id, triggeredBy, (subEntity, product) =>
      applyLifecycle(subEntity.id, this.entityToState(subEntity, product), {
        kind: 'resume',
        at: new Date(),
      }),
    );
  }

  async extendTrial(id: string, newTrialEndsAt: Date, triggeredBy: TriggeredBy = 'admin'): Promise<Subscription> {
    return this.runLifecycleTransition(id, triggeredBy, (subEntity, product) =>
      applyLifecycle(subEntity.id, this.entityToState(subEntity, product), {
        kind: 'trial_extend',
        at: new Date(),
        newTrialEndsAt,
      }),
    );
  }

  // ════════ Cron-driven operations ════════════════════════════════════════

  async expireToPastDue(sub: Subscription): Promise<void> {
    if (sub.status !== 'active' && sub.status !== 'canceling') return;
    await this.runLifecycleTransition(sub.id, 'cron', (subEntity, product) =>
      applyLifecycle(subEntity.id, this.entityToState(subEntity, product), {
        kind: 'period_ended_unpaid',
        at: new Date(),
        gracePeriodDays: GRACE_PERIOD_DAYS,
      }),
    );
  }

  /** Cron: dispara cuando trialEndsAt vence sin pago. */
  async triggerTrialEnded(sub: Subscription): Promise<void> {
    if (sub.status !== 'trialing') return;
    await this.runLifecycleTransition(sub.id, 'cron', (subEntity, product) =>
      applyLifecycle(subEntity.id, this.entityToState(subEntity, product), {
        kind: 'trial_ended',
        at: new Date(),
        gracePeriodDays: GRACE_PERIOD_DAYS,
      }),
    );
  }

  async downgradeOnGraceExpiry(sub: Subscription): Promise<void> {
    if (sub.status !== 'past_due') return;
    await this.runLifecycleTransition(sub.id, 'cron', (subEntity, product) =>
      applyLifecycle(subEntity.id, this.entityToState(subEntity, product), {
        kind: 'grace_expired',
        at: new Date(),
      }),
    );
  }

  /** Emite reminder via outbox. Eventos distintos por T-7/3/1 día. */
  async dispatchRenewalReminder(sub: Subscription, daysToEnd: 7 | 3 | 1): Promise<void> {
    const eventKind: EventKind = `subscription.renewal_due_${daysToEnd}d` as EventKind;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const product = await this.products.findById(sub.productId);

    const result = await this.dataSource.transaction(async (em) => {
      const appendResult = await this.outbox.append(em, {
        applicationId: sub.applicationId,
        aggregateType: 'subscription',
        aggregateId: sub.id,
        eventKind,
        deliveryKey: `sub_${sub.id}.renewal_due_${daysToEnd}d.${today}`,
        payload: {
          subscription_id: sub.id,
          external_subscription_id: sub.externalSubscriptionId,
          customer_id: sub.customerId,
          product_id: product.id,
          product_sku: product.sku,
          billing_cycle: sub.billingCycle,
          current_period_end: sub.currentPeriodEnd.toISOString(),
          days_to_end: daysToEnd,
        },
        internalHandlers: ['renewal_reminder_email'],
      });
      await this.recordAuditEvent(em, sub.id, 'renewal_reminder_sent', null, null, 'cron', {
        days_to_end: daysToEnd,
        deduplicated: appendResult.deduplicated,
      });
      return appendResult.deliveryIds;
    });

    if (result.length > 0) await this.outboxQueue.dispatchMany(result);
  }

  // ════════ Queries (read-only) ═══════════════════════════════════════════

  findById(id: string): Promise<Subscription> {
    return this.requireById(id);
  }

  findByExternalId(applicationId: string, externalId: string) {
    return this.subscriptions.findByExternalId(applicationId, externalId);
  }

  list(opts: IPaginationOptions & { applicationId?: string; customerId?: string; status?: string }) {
    return this.subscriptions.findMany(opts);
  }

  /**
   * Re-emite el webhook `subscription.renewed` para el período actual.
   * Útil cuando la automatización falló (webhook no registrado, caída de red, etc.)
   * sin necesidad de volver a cobrar al cliente.
   */
  async resendRenewedWebhook(subscriptionId: string): Promise<{ deliveryIds: string[] }> {
    const sub = await this.requireById(subscriptionId);
    if (!sub.currentPeriodStart || !sub.currentPeriodEnd) {
      throw new BadRequestException('La suscripción no tiene período activo.');
    }

    const productId = sub.scheduledProductId ?? sub.productId;
    const product = await this.products.findById(productId);

    const deliveryIds = await this.dataSource.transaction(async (em) => {
      const result = await this.outbox.append(em, {
        applicationId: sub.applicationId,
        aggregateType: 'subscription',
        aggregateId: sub.id,
        eventKind: 'subscription.renewed',
        // Clave única con sufijo para evitar deduplicación contra el evento original.
        deliveryKey: `sub_${sub.id}.renewed.${sub.currentPeriodStart!.toISOString()}.resend`,
        payload: {
          subscription_id: sub.id,
          external_subscription_id: sub.externalSubscriptionId,
          product_id: productId,
          product_sku: product.sku,
          billing_cycle: sub.billingCycle,
          current_period_start: sub.currentPeriodStart!.toISOString(),
          current_period_end: sub.currentPeriodEnd!.toISOString(),
          status: sub.status,
        },
      });
      return result.deliveryIds;
    });

    if (deliveryIds.length > 0) await this.outboxQueue.dispatchMany(deliveryIds);
    return { deliveryIds };
  }

  listEvents(subscriptionId: string) {
    return this.subscriptions.listEvents(subscriptionId);
  }

  findEndingBetween(start: Date, end: Date, status: string) {
    return this.subscriptions.findEndingBetween(start, end, status);
  }

  findExpiredGrace(now: Date) {
    return this.subscriptions.findExpiredGrace(now);
  }

  // ════════ Core helpers ══════════════════════════════════════════════════

  /**
   * Patrón canónico para una transición de lifecycle:
   * 1. Load entity + product (TX, lock pessimistic_write)
   * 2. Llama al lifecycle pasado por el caller
   * 3. Persist next state + audit event + outbox events (mismo TX)
   * 4. Post-commit: enqueue dispatches
   *
   * El caller solo arma el `LifecycleEvent` correcto.
   */
  private async runLifecycleTransition(
    subscriptionId: string,
    triggeredBy: TriggeredBy,
    transition: (subEntity: SubscriptionEntity, product: Product) => LifecycleResult,
  ): Promise<Subscription> {
    const result = await this.dataSource.transaction(async (em) => {
      const subRepo = em.getRepository(SubscriptionEntity);

      const entity = await subRepo.findOne({
        where: { id: subscriptionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) throw new NotFoundException('Subscription not found');

      const productId = entity.scheduledProductId ?? entity.productId;
      const product = await this.products.findById(productId);

      const lifecycleResult = transition(entity, product);
      const success = this.expectSuccess(lifecycleResult);

      const fromStatus = entity.status as SubscriptionStatus;
      this.mutateEntityFromState(entity, success.next);
      const saved = await subRepo.save(entity);

      await this.recordAuditEvent(
        em,
        saved.id,
        this.auditTypeForEmit(success),
        fromStatus,
        saved.status as SubscriptionStatus,
        triggeredBy,
        { emitted: success.emit.map((e) => e.eventKind) },
      );

      const deliveryIds = await this.appendOutboxEvents(em, saved.applicationId, saved.id, success.emit);
      return { saved, deliveryIds };
    });

    if (result.deliveryIds.length > 0) {
      await this.outboxQueue.dispatchMany(result.deliveryIds);
    }
    return SubscriptionMapper.toDomain(result.saved);
  }

  private expectSuccess(result: LifecycleResult): LifecycleSuccess {
    if (!result.ok) {
      if (result.code === 'invalid_input') throw new BadRequestException(result.message);
      throw new ConflictException(result.message);
    }
    return result;
  }

  /** Convierte entity TypeORM → SubscriptionState para el lifecycle. */
  private entityToState(entity: SubscriptionEntity, product: Product): SubscriptionState {
    const scheduledProduct: ProductRef | null =
      entity.scheduledProductId !== null
        ? { id: entity.scheduledProductId, sku: product.sku }
        : null;
    // NOTA: si el scheduledProduct es DIFERENTE al product cargado, esto es una inconsistencia.
    // Por ahora el sku del scheduled puede ser stale; el caller debe re-cargar en la próxima
    // transición. La consistencia se garantiza en `paid` que aplica el cambio.
    return {
      status: entity.status as SubscriptionStatus,
      billingCycle: entity.billingCycle as 'monthly' | 'annual',
      product: { id: product.id, sku: product.sku },
      currentPeriodStart: entity.currentPeriodStart,
      currentPeriodEnd: entity.currentPeriodEnd,
      gracePeriodUntil: entity.gracePeriodUntil,
      scheduledProduct,
      scheduledBillingCycle: entity.scheduledBillingCycle as 'monthly' | 'annual' | null,
      scheduledAt: entity.scheduledAt,
      trialEndsAt: entity.trialEndsAt,
      canceledAt: entity.canceledAt,
      cancelReason: entity.cancelReason,
    };
  }

  /** Mutates entity in-place según el next state del lifecycle. */
  private mutateEntityFromState(entity: SubscriptionEntity, next: SubscriptionState): void {
    entity.status = next.status;
    entity.billingCycle = next.billingCycle;
    entity.productId = next.product.id;
    entity.currentPeriodStart = next.currentPeriodStart;
    entity.currentPeriodEnd = next.currentPeriodEnd;
    entity.gracePeriodUntil = next.gracePeriodUntil;
    entity.scheduledProductId = next.scheduledProduct?.id ?? null;
    entity.scheduledBillingCycle = next.scheduledBillingCycle;
    entity.scheduledAt = next.scheduledAt;
    entity.trialEndsAt = next.trialEndsAt;
    entity.canceledAt = next.canceledAt;
    entity.cancelReason = next.cancelReason;
  }

  private async appendOutboxEvents(
    em: EntityManager,
    applicationId: string,
    subscriptionId: string,
    events: LifecycleSuccess['emit'],
  ): Promise<string[]> {
    const ids: string[] = [];
    for (const evt of events) {
      const result = await this.outbox.append(em, {
        applicationId,
        aggregateType: 'subscription',
        aggregateId: subscriptionId,
        eventKind: evt.eventKind as EventKind,
        deliveryKey: evt.deliveryKey,
        payload: evt.payload,
      });
      ids.push(...result.deliveryIds);
    }
    return ids;
  }

  private async recordAuditEvent(
    em: EntityManager,
    subscriptionId: string,
    type: string,
    fromStatus: SubscriptionStatus | null,
    toStatus: SubscriptionStatus | null,
    triggeredBy: TriggeredBy,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    const repo = em.getRepository(SubscriptionEventEntity);
    await repo.save(
      repo.create({
        subscriptionId,
        type,
        fromStatus,
        toStatus,
        triggeredBy,
        metadata,
      }),
    );
  }

  /** Resumen humano-legible del evento principal emitido (para el audit log). */
  private auditTypeForEmit(result: LifecycleSuccess): string {
    if (result.emit.length === 0) return 'scheduled';
    const first = result.emit[0].eventKind;
    return first.replace(/^subscription\./, '').replace(/^invoice\./, '');
  }

  private async requireById(id: string): Promise<Subscription> {
    const s = await this.subscriptions.findById(id);
    if (!s) throw new NotFoundException('Subscription not found');
    return s;
  }

  private async resolveProduct(productId?: string, productSku?: string): Promise<Product> {
    if (productId && productSku) {
      throw new BadRequestException('Provee productId O productSku, no ambos.');
    }
    if (productId) return this.products.findById(productId);
    if (productSku) return this.products.findBySku(productSku);
    throw new BadRequestException('Provee productId o productSku.');
  }
}
