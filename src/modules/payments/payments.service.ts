import { Queue } from 'bullmq';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Inject,
  Logger,
  Injectable,
  forwardRef,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { Payment } from './domain/payment';
import { Money } from '@/common/money/money';
import { AllConfigType } from '@/config/config.type';
import { CreatePaymentBodyDto } from './dto/create-payment.dto';
import { InvoicesService } from '@/modules/invoices/invoices.service';
import { OutboxService } from '@/modules/outbox/outbox.service';
import { OutboxQueue } from '@/modules/outbox/outbox-queue.service';
import { SubscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import { PaymentEntity } from './infrastructure/persistence/relational/entities/payment.entity';
import { PaymentMethodKind, PaymentGatewayPort } from '@/modules/gateways/sitef/payment-gateway.port';
import { PaymentAttemptEntity } from './infrastructure/persistence/relational/entities/payment-attempt.entity';

export const PAYMENT_POLLING_QUEUE = 'payment-polling';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PaymentEntity)
    private readonly paymentsRepo: Repository<PaymentEntity>,
    @InjectRepository(PaymentAttemptEntity)
    private readonly attemptsRepo: Repository<PaymentAttemptEntity>,
    @InjectQueue(PAYMENT_POLLING_QUEUE)
    private readonly pollingQueue: Queue,
    private readonly gateway: PaymentGatewayPort,
    private readonly invoices: InvoicesService,
    private readonly outbox: OutboxService,
    private readonly outboxQueue: OutboxQueue,
    private readonly configService: ConfigService<AllConfigType>,
    @Inject(forwardRef(() => SubscriptionsService))
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /** Llamado desde el checkout público (token). Crea Payment + primer PaymentAttempt + dispara gateway. */
  async createForInvoice(invoiceId: string, dto: CreatePaymentBodyDto): Promise<Payment> {
    const invoice = await this.invoices.findById(invoiceId);
    if (invoice.status === 'paid') throw new ConflictException('La factura ya fue pagada.');
    if (invoice.status !== 'open')
      throw new BadRequestException(`Factura en estado ${invoice.status} no acepta pagos.`);

    // Idempotency: si ya existe un payment con la misma key + application, devolverlo.
    const existing = await this.paymentsRepo.findOne({
      where: { applicationId: invoice.applicationId, idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      this.logger.log(`Payment idempotent hit: ${existing.id}`);
      return this.toDomain(existing);
    }

    const payment = await this.paymentsRepo.save(
      this.paymentsRepo.create({
        applicationId: invoice.applicationId,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        idempotencyKey: dto.idempotencyKey,
        status: 'pending',
        methodKind: dto.method,
        gateway: dto.method === 'zelle' ? 'zelle_manual' : 'sitef',
        displayCurrency: invoice.displayCurrency,
        displayAmount: invoice.displayAmount,
        fxRateSource: invoice.fxRateSource,
        fxRateUsed: invoice.fxRateUsed,
        fxRateDate: invoice.fxRateDate,
        chargedCurrency: invoice.chargedCurrency,
        chargedAmount: invoice.chargedAmount,
        methodData: dto.methodData,
      }),
    );

    await this.invokeGateway(payment, dto.method, dto.methodData, invoice.number ?? payment.id);
    return this.toDomain(await this.paymentsRepo.findOneOrFail({ where: { id: payment.id } }));
  }

  /** Submit OTP para un payment C2P pendiente. */
  async submitOtp(paymentId: string, otp: string): Promise<Payment> {
    const payment = await this.paymentsRepo.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'requires_otp') {
      throw new BadRequestException(`Payment en estado ${payment.status} no acepta OTP.`);
    }
    if (payment.methodKind !== 'c2p' && payment.methodKind !== 'card_ccr') {
      throw new BadRequestException('OTP solo aplica a los métodos C2P y tarjeta CCR.');
    }

    const invoice = payment.invoiceId ? await this.invoices.findById(payment.invoiceId) : null;

    const result = await this.gateway.submitOtp({
      applicationId: payment.applicationId,
      method: payment.methodKind as 'c2p' | 'card_ccr',
      invoiceNumber: invoice?.number ?? payment.id,
      amount: this.amountForGateway(payment),
      otp,
      methodData: {
        ...(payment.methodData ?? {}),
        gatewayReference: payment.gatewayReference, // orderId para CCR step 2
      } as Record<string, unknown>,
    });

    await this.attemptsRepo.save(
      this.attemptsRepo.create({
        paymentId: payment.id,
        status: result.status,
        failureCode: result.failureCode ?? null,
        failureMessage: result.failureMessage ?? null,
        rawRequest: result.rawRequest,
        rawResponse: result.rawResponse,
        settledAt: result.status === 'succeeded' || result.status === 'failed' ? new Date() : null,
      }),
    );

    await this.applyGatewayResult(payment.id, result);
    return this.toDomain(await this.paymentsRepo.findOneOrFail({ where: { id: payment.id } }));
  }

  async findById(id: string): Promise<Payment> {
    const p = await this.paymentsRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Payment not found');
    return this.toDomain(p);
  }

  /** Punto de entrada del polling worker (no expuesto en HTTP). */
  async pollOnce(paymentId: string): Promise<{ done: boolean }> {
    const payment = await this.paymentsRepo.findOne({ where: { id: paymentId } });
    if (!payment) return { done: true };
    if (payment.status === 'succeeded' || payment.status === 'failed' || payment.status === 'canceled') {
      return { done: true };
    }

    const invoice = payment.invoiceId ? await this.invoices.findById(payment.invoiceId) : null;

    const md = (payment.methodData ?? {}) as Record<string, unknown>;
    const result = await this.gateway.getStatus({
      applicationId: payment.applicationId,
      method: payment.methodKind as PaymentMethodKind,
      invoiceNumber: invoice?.number ?? payment.id,
      amount: this.amountForGateway(payment),
      methodData: { ...md, trxDate: this.todayCaracas() },
    });

    await this.attemptsRepo.save(
      this.attemptsRepo.create({
        paymentId: payment.id,
        status: result.status,
        rawRequest: { kind: 'poll' },
        rawResponse: result.rawResponse,
        pollCount: 1,
        settledAt: result.status === 'succeeded' || result.status === 'failed' ? new Date() : null,
      }),
    );

    if (result.status === 'succeeded') {
      payment.status = 'succeeded';
      payment.gatewayReference = result.gatewayReference ?? payment.gatewayReference;
      payment.succeededAt = new Date();
      await this.paymentsRepo.save(payment);
      await this.onPaymentSucceeded(payment);
      return { done: true };
    }

    if (result.status === 'failed') {
      payment.status = 'failed';
      payment.failureCode = result.failureCode ?? null;
      payment.failureMessage = result.failureMessage ?? null;
      payment.failedAt = new Date();
      await this.paymentsRepo.save(payment);
      await this.emitPaymentFailed(payment);
      return { done: true };
    }

    return { done: false };
  }

  /** Encolar polling con el backoff configurado. */
  async schedulePolling(paymentId: string, attemptIndex: number = 0): Promise<void> {
    const schedule = this.configService.getOrThrow('payments.pollingBackoffSeconds', { infer: true });
    const delaySec = schedule[attemptIndex];
    if (delaySec === undefined) return; // ya agotó intentos

    await this.pollingQueue.add(
      'poll',
      { paymentId, nextAttemptIndex: attemptIndex + 1 },
      { delay: delaySec * 1000, removeOnComplete: 200, removeOnFail: 500, attempts: 1 },
    );
  }

  // -- Privados --------------------------------------------------------------

  private async invokeGateway(
    payment: PaymentEntity,
    method: PaymentMethodKind,
    methodData: Record<string, unknown>,
    invoiceNumber: string,
  ): Promise<void> {
    if (payment.gateway === 'zelle_manual') {
      // Zelle queda en pending hasta que un admin lo confirme manualmente.
      return;
    }

    const result = await this.gateway.createPayment({
      applicationId: payment.applicationId,
      method,
      invoiceNumber,
      amount: this.amountForGateway(payment),
      methodData,
    });

    await this.attemptsRepo.save(
      this.attemptsRepo.create({
        paymentId: payment.id,
        status: result.status,
        failureCode: result.failureCode ?? null,
        failureMessage: result.failureMessage ?? null,
        rawRequest: result.rawRequest,
        rawResponse: result.rawResponse,
        settledAt: result.status === 'succeeded' || result.status === 'failed' ? new Date() : null,
      }),
    );

    await this.applyGatewayResult(payment.id, result);
  }

  private async applyGatewayResult(
    paymentId: string,
    result: {
      status: string;
      gatewayReference?: string | null;
      failureCode?: string;
      failureMessage?: string;
      redirectUrl?: string;
    },
  ): Promise<void> {
    const payment = await this.paymentsRepo.findOneOrFail({ where: { id: paymentId } });
    payment.gatewayReference = result.gatewayReference ?? payment.gatewayReference;

    switch (result.status) {
      case 'succeeded':
        payment.status = 'succeeded';
        payment.succeededAt = new Date();
        break;
      case 'requires_otp':
        payment.status = 'requires_otp';
        break;
      case 'requires_action':
        payment.status = 'requires_action';
        payment.methodData = { ...(payment.methodData ?? {}), redirectUrl: result.redirectUrl };
        break;
      case 'failed':
        payment.status = 'failed';
        payment.failureCode = result.failureCode ?? null;
        payment.failureMessage = result.failureMessage ?? null;
        payment.failedAt = new Date();
        break;
    }

    await this.paymentsRepo.save(payment);

    if (payment.status === 'succeeded') {
      await this.onPaymentSucceeded(payment);
    } else if (payment.status === 'failed') {
      await this.emitPaymentFailed(payment);
    } else if (payment.status === 'requires_action') {
      // Web Button: hay que polear hasta resolver.
      await this.schedulePolling(payment.id, 0);
    }
  }

  private async onPaymentSucceeded(payment: PaymentEntity): Promise<void> {
    if (payment.invoiceId) {
      // Atomic: markPaid + outbox.append(invoice.paid) en una sola transacción.
      // Si commit falla, ni el invoice se marca paid ni se emite el evento.
      const { invoice, deliveryIds } = await this.dataSource.transaction(async (em) => {
        const inv = await this.invoices.markPaid(payment.invoiceId!, em);
        const append = await this.outbox.append(em, {
          applicationId: payment.applicationId,
          aggregateType: 'invoice',
          aggregateId: inv.id,
          eventKind: 'invoice.paid',
          deliveryKey: `inv_${inv.id}.paid.${payment.id}`,
          payload: { invoice_id: payment.invoiceId, payment_id: payment.id },
        });
        return { invoice: inv, deliveryIds: append.deliveryIds };
      });

      if (deliveryIds.length > 0) await this.outboxQueue.dispatchMany(deliveryIds);

      // Subscription advance es independiente — `subscriptions.onRenewalPaid` tiene
      // su propia transacción atómica (state + audit + outbox.append). Si falla,
      // el invoice ya quedó paid, lo cual es el invariante correcto: el pago se
      // confirmó. El admin puede re-disparar manualmente la renovación.
      const subscriptionItem = invoice.items.find(
        (it) => it.metadata && typeof it.metadata['subscription_id'] === 'string',
      );
      if (subscriptionItem) {
        const subscriptionId = subscriptionItem.metadata!['subscription_id'] as string;
        try {
          await this.subscriptions.onRenewalPaid(subscriptionId, invoice.id, payment.id);
        } catch (err) {
          this.logger.error(`onRenewalPaid falló para sub=${subscriptionId}: ${(err as Error).message}`);
        }
      }
    }
    await this.emitPaymentSucceeded(payment);
  }

  private async emitPaymentSucceeded(payment: PaymentEntity): Promise<void> {
    await this.emitOutbox(
      payment.applicationId,
      'payment',
      payment.id,
      'payment.succeeded',
      `pay_${payment.id}.succeeded`,
      this.toWebhookPayload(payment),
    );
  }

  private async emitPaymentFailed(payment: PaymentEntity): Promise<void> {
    await this.emitOutbox(
      payment.applicationId,
      'payment',
      payment.id,
      'payment.failed',
      `pay_${payment.id}.failed`,
      this.toWebhookPayload(payment),
    );
  }

  /**
   * Apend to outbox dentro de TX + dispatch post-commit. El `deliveryKey` semántico
   * garantiza idempotency a nivel DB — si el mismo evento de negocio se intenta emitir
   * dos veces (ej. polling worker reintenta), la segunda inserción es no-op.
   */
  private async emitOutbox(
    applicationId: string,
    aggregateType: 'subscription' | 'invoice' | 'payment' | 'customer',
    aggregateId: string,
    eventKind: 'invoice.paid' | 'payment.succeeded' | 'payment.failed',
    deliveryKey: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const deliveryIds = await this.dataSource.transaction(async (em: EntityManager) => {
      const result = await this.outbox.append(em, {
        applicationId,
        aggregateType,
        aggregateId,
        eventKind,
        deliveryKey,
        payload,
      });
      return result.deliveryIds;
    });
    if (deliveryIds.length > 0) await this.outboxQueue.dispatchMany(deliveryIds);
  }

  private toWebhookPayload(payment: PaymentEntity): Record<string, unknown> {
    return {
      payment_id: payment.id,
      invoice_id: payment.invoiceId,
      customer_id: payment.customerId,
      status: payment.status,
      method: payment.methodKind,
      display_amount: payment.displayAmount,
      display_currency: payment.displayCurrency,
      charged_amount: payment.chargedAmount,
      charged_currency: payment.chargedCurrency,
      gateway_reference: payment.gatewayReference,
    };
  }

  /**
   * Sitef cobra en VES. Si tenemos `chargedAmount` (FX snapshot al issue del invoice),
   * lo usamos. Si no, usamos `displayAmount` directo — solo es válido cuando la
   * moneda de visualización ya es VES.
   *
   * Money construye con scale validation, así que esto rechaza valores corruptos
   * antes de mandar al gateway.
   */
  private amountForGateway(payment: PaymentEntity): string {
    const raw = payment.chargedAmount ?? payment.displayAmount;
    const currency = (payment.chargedCurrency ?? payment.displayCurrency) as 'EUR' | 'USD' | 'VES';
    // Validación: tira si el monto persistido está mal formado.
    return Money.parse(raw, currency).toFixed();
  }

  private todayCaracas(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private toDomain(entity: PaymentEntity): Payment {
    return Object.assign(new Payment(), {
      id: entity.id,
      applicationId: entity.applicationId,
      customerId: entity.customerId,
      invoiceId: entity.invoiceId,
      idempotencyKey: entity.idempotencyKey,
      status: entity.status as Payment['status'],
      methodKind: entity.methodKind as Payment['methodKind'],
      gateway: entity.gateway as Payment['gateway'],
      gatewayReference: entity.gatewayReference,
      displayCurrency: entity.displayCurrency,
      displayAmount: entity.displayAmount,
      fxRateSource: entity.fxRateSource,
      fxRateUsed: entity.fxRateUsed,
      fxRateDate: entity.fxRateDate,
      chargedCurrency: entity.chargedCurrency,
      chargedAmount: entity.chargedAmount,
      failureCode: entity.failureCode,
      failureMessage: entity.failureMessage,
      succeededAt: entity.succeededAt,
      failedAt: entity.failedAt,
      methodData: entity.methodData,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }
}
