import { randomUUID } from 'crypto';
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
import { Invoice } from '@/modules/invoices/domain/invoice';
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

    // Corta la reutilización ANTES de llamar a Sitef: si esta referencia ya pagó otra
    // factura, no hay nada que verificar y el cliente recibe el motivo exacto.
    const paymentReference = this.normalizeReference(dto.methodData?.paymentReference);
    if (paymentReference) {
      await this.assertReferenceUnused(invoice.applicationId, invoice.id, paymentReference);
    }

    const payment = await this.paymentsRepo.save(
      this.paymentsRepo.create({
        paymentReference,
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
        // El gateway recibe dto.methodData completo; en la fila solo persistimos lo no
        // sensible (nunca PAN/CVV — ver sanitizeMethodDataForStorage).
        methodData: this.sanitizeMethodDataForStorage(dto.method, dto.methodData),
      }),
    );

    await this.invokeGateway(payment, dto.method, dto.methodData, invoice.number ?? payment.id);
    return this.toDomain(await this.paymentsRepo.findOneOrFail({ where: { id: payment.id } }));
  }

  /**
   * Verificación manual (admin): reusa el flujo del checkout para verificar un pago por
   * referencia contra Sitef (transfer / pago_movil). En éxito otorga la factura/suscripción.
   * Genera una idempotencyKey nueva por intento para permitir reintentos del admin.
   */
  async verifyForInvoice(
    invoiceId: string,
    method: 'transfer' | 'pago_movil',
    methodData: Record<string, unknown>,
  ): Promise<Payment> {
    return this.createForInvoice(invoiceId, {
      method,
      methodData,
      idempotencyKey: `manual-verify-${invoiceId}-${randomUUID()}`,
    });
  }

  /**
   * Force-grant (admin): marca la factura como pagada SIN cobrar — registra un pago `manual`
   * con el motivo (auditoría) y dispara el mismo grant que un pago real (invoice.paid →
   * activa la suscripción si aplica).
   *
   * Toda la operación va en una transacción serializada por el compare-and-swap de
   * `markPaid`: solo el ganador crea el Payment, marca la factura y encola invoice.paid.
   * Un segundo grant concurrente (doble-click, o admin + pago real simultáneo) pierde el
   * CAS y se rechaza limpio con Conflict — sin Payment duplicado ni doble webhook.
   */
  async grantManually(invoiceId: string, reason: string): Promise<Payment> {
    const invoice = await this.invoices.findById(invoiceId);
    if (invoice.status === 'paid') throw new ConflictException('La factura ya fue pagada.');
    if (invoice.status !== 'open')
      throw new BadRequestException(`Factura en estado ${invoice.status} no acepta otorgamiento manual.`);

    const settled = await this.dataSource.transaction(async (em) => {
      const { invoice: inv, transitioned } = await this.invoices.markPaid(invoiceId, em);
      if (!transitioned) return null;

      const repo = em.getRepository(PaymentEntity);
      const payment = await repo.save(
        repo.create({
          applicationId: inv.applicationId,
          customerId: inv.customerId,
          invoiceId: inv.id,
          idempotencyKey: `manual-grant-${invoiceId}-${randomUUID()}`,
          status: 'succeeded',
          methodKind: 'manual',
          gateway: 'manual',
          displayCurrency: inv.displayCurrency,
          displayAmount: inv.displayAmount,
          fxRateSource: inv.fxRateSource,
          fxRateUsed: inv.fxRateUsed,
          fxRateDate: inv.fxRateDate,
          chargedCurrency: inv.chargedCurrency,
          chargedAmount: inv.chargedAmount,
          methodData: { manual: true, reason },
          succeededAt: new Date(),
        }),
      );

      const append = await this.outbox.append(em, {
        applicationId: payment.applicationId,
        aggregateType: 'invoice',
        aggregateId: inv.id,
        eventKind: 'invoice.paid',
        deliveryKey: `inv_${inv.id}.paid`,
        payload: { invoice_id: inv.id, payment_id: payment.id },
      });

      return { payment, invoice: inv, deliveryIds: append.deliveryIds };
    });

    // Perdió el CAS — otra confirmación marcó la factura paid primero.
    if (!settled) throw new ConflictException('La factura ya fue pagada.');

    if (settled.deliveryIds.length > 0) await this.outboxQueue.dispatchMany(settled.deliveryIds);
    await this.advanceSubscriptionIfAny(settled.invoice, settled.payment);
    await this.emitPaymentSucceeded(settled.payment);

    return this.toDomain(settled.payment);
  }

  /** Submit OTP para un payment C2P pendiente. */
  async submitOtp(
    paymentId: string,
    otp: string,
    extraMethodData?: Record<string, unknown>,
  ): Promise<Payment> {
    const payment = await this.paymentsRepo.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'requires_otp') {
      throw new BadRequestException(`Payment en estado ${payment.status} no acepta OTP.`);
    }
    if (payment.methodKind !== 'c2p' && payment.methodKind !== 'card_ccr' && payment.methodKind !== 'card') {
      throw new BadRequestException('OTP solo aplica a los métodos C2P y tarjeta.');
    }

    const invoice = payment.invoiceId ? await this.invoices.findById(payment.invoiceId) : null;

    const result = await this.gateway.submitOtp({
      applicationId: payment.applicationId,
      method: payment.methodKind as 'c2p' | 'card_ccr' | 'card',
      invoiceNumber: invoice?.number ?? payment.id,
      amount: this.amountForGateway(payment),
      otp,
      methodData: {
        ...(payment.methodData ?? {}),
        ...(extraMethodData ?? {}), // tarjeta reenviada (débito Mercantil); no se persiste
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
      payment.paymentReference = payment.paymentReference ?? this.gatewayReferenceKey(result.gatewayReference);
      if (!(await this.persistSettled(payment))) {
        await this.emitPaymentFailed(await this.paymentsRepo.findOneOrFail({ where: { id: payment.id } }));
        return { done: true };
      }
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
      methodDataPatch?: Record<string, unknown>;
    },
  ): Promise<void> {
    const payment = await this.paymentsRepo.findOneOrFail({ where: { id: paymentId } });
    payment.gatewayReference = result.gatewayReference ?? payment.gatewayReference;

    // Estado de sesión que el gateway necesita en el paso siguiente (ej. authenticationToken
    // del débito inmediato vía Mercantil). submitOtp lo reinyecta desde method_data.
    if (result.methodDataPatch) {
      payment.methodData = { ...(payment.methodData ?? {}), ...result.methodDataPatch };
    }

    switch (result.status) {
      case 'succeeded':
        payment.status = 'succeeded';
        payment.succeededAt = new Date();
        // Métodos sin referencia tecleada (C2P, tarjeta): la que identifica el movimiento
        // es la que emite el gateway. Se guarda tal cual —no es input del cliente— para
        // que el índice único también cubra estos métodos.
        payment.paymentReference = payment.paymentReference ?? this.gatewayReferenceKey(result.gatewayReference);
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

    if (payment.status === 'succeeded') {
      if (!(await this.persistSettled(payment))) {
        // Perdió el índice único: la referencia ya acreditó otra factura.
        await this.emitPaymentFailed(await this.paymentsRepo.findOneOrFail({ where: { id: payment.id } }));
        return;
      }
      await this.onPaymentSucceeded(payment);
      return;
    }

    await this.paymentsRepo.save(payment);

    if (payment.status === 'failed') {
      await this.emitPaymentFailed(payment);
    } else if (payment.status === 'requires_action') {
      // Web Button: hay que polear hasta resolver.
      await this.schedulePolling(payment.id, 0);
    }
  }

  /**
   * Normaliza la referencia tecleada por el cliente igual que el adapter (últimos 8 dígitos).
   * Debe coincidir con `toPaymentReference`: si aquí guardáramos los 10 dígitos completos y
   * allá mandáramos 8, alguien podría re-acreditar el mismo movimiento anteponiendo dígitos.
   */
  private normalizeReference(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const digits = String(value).replace(/\D/g, '');
    if (digits.length === 0) return null;
    return digits.length > 8 ? digits.slice(-8) : digits;
  }

  /** Referencia emitida por el gateway: se usa tal cual (no es input del cliente). */
  private gatewayReferenceKey(value: string | number | null | undefined): string | null {
    // Defensivo con String(): Sitef mezcla tipos entre motores (referenceId de CCR llega como
    // NUMBER). Un .trim() sobre un number aquí convirtió en 500 un pago YA COBRADO por el banco.
    const trimmed = String(value ?? '').trim();
    return trimmed.length > 0 ? trimmed.slice(0, 32) : null;
  }

  /**
   * Rechaza reutilizar una referencia ya acreditada. Se consulta por aplicación (cada
   * comercio tiene su propio universo de referencias) y se ignora la propia factura, para
   * no romper el reintento legítimo sobre el mismo cobro.
   */
  private async assertReferenceUnused(applicationId: string, invoiceId: string, reference: string): Promise<void> {
    const clash = await this.paymentsRepo.findOne({
      where: { applicationId, paymentReference: reference, status: 'succeeded' },
    });
    if (clash && clash.invoiceId !== invoiceId) {
      throw new ConflictException(
        `Esta referencia ya fue usada para pagar otra factura. Cada pago solo puede acreditarse una vez.`,
      );
    }
  }

  /**
   * Guarda el pago liquidado. El índice único parcial es el árbitro final del doble-cobro:
   * si otra fila ya acreditó esta referencia (dos pestañas en paralelo, o un poll que llega
   * tarde), Postgres rechaza la escritura y el pago queda `failed` con el motivo — en vez
   * de otorgar la misma factura dos veces. Devuelve false si perdió la carrera.
   */
  private async persistSettled(payment: PaymentEntity): Promise<boolean> {
    try {
      await this.paymentsRepo.save(payment);
      return true;
    } catch (err) {
      if (!this.isDuplicateReferenceViolation(err)) throw err;
      this.logger.warn(
        `Referencia ${payment.paymentReference} ya acreditada en app ${payment.applicationId} — pago ${payment.id} rechazado.`,
      );
      await this.paymentsRepo.update(payment.id, {
        status: 'failed',
        failureCode: 'REFERENCE_ALREADY_USED',
        failureMessage: 'Esta referencia ya fue usada para pagar otra factura.',
        failedAt: new Date(),
        succeededAt: null,
      });
      return false;
    }
  }

  private isDuplicateReferenceViolation(err: unknown): boolean {
    const e = err as { code?: string; constraint?: string; driverError?: { code?: string; constraint?: string } };
    const code = e?.code ?? e?.driverError?.code;
    const constraint = e?.constraint ?? e?.driverError?.constraint;
    return code === '23505' && constraint === 'UQ_payment_reference_settled';
  }

  private async onPaymentSucceeded(payment: PaymentEntity): Promise<void> {
    if (payment.invoiceId) {
      // markPaid es un compare-and-swap atómico: solo la PRIMERA confirmación de este
      // invoice gana la transición (`transitioned=true`). Así, si dos pagos resuelven el
      // mismo invoice (ej. force-grant del admin + un poll de C2P que llega tarde), el
      // webhook invoice.paid y el avance de la suscripción ocurren UNA sola vez.
      // El append al outbox va en la misma transacción que el markPaid.
      const { invoice, transitioned, deliveryIds } = await this.dataSource.transaction(async (em) => {
        const { invoice: inv, transitioned: won } = await this.invoices.markPaid(payment.invoiceId!, em);
        if (!won) return { invoice: inv, transitioned: false, deliveryIds: [] as string[] };
        const append = await this.outbox.append(em, {
          applicationId: payment.applicationId,
          aggregateType: 'invoice',
          aggregateId: inv.id,
          eventKind: 'invoice.paid',
          // deliveryKey scoped al invoice (no al payment): doble defensa — el UNIQUE del
          // outbox garantiza un solo invoice.paid aunque dos pagos ganaran la transición.
          deliveryKey: `inv_${inv.id}.paid`,
          payload: { invoice_id: payment.invoiceId, payment_id: payment.id },
        });
        return { invoice: inv, transitioned: true, deliveryIds: append.deliveryIds };
      });

      if (transitioned) {
        if (deliveryIds.length > 0) await this.outboxQueue.dispatchMany(deliveryIds);
        await this.advanceSubscriptionIfAny(invoice, payment);
      }
    }
    await this.emitPaymentSucceeded(payment);
  }

  /**
   * Avanza la suscripción si el invoice corresponde a una renovación. Best-effort e
   * independiente: `subscriptions.onRenewalPaid` tiene su propia transacción atómica
   * (state + audit + outbox.append). Si falla, el invoice ya quedó paid —invariante
   * correcto, el pago se confirmó— y el admin puede re-disparar la renovación.
   */
  private async advanceSubscriptionIfAny(invoice: Invoice, payment: PaymentEntity): Promise<void> {
    const subscriptionItem = invoice.items.find(
      (it) => it.metadata && typeof it.metadata['subscription_id'] === 'string',
    );
    if (!subscriptionItem) return;
    const subscriptionId = subscriptionItem.metadata!['subscription_id'] as string;
    try {
      await this.subscriptions.onRenewalPaid(subscriptionId, invoice.id, payment.id);
    } catch (err) {
      this.logger.error(`onRenewalPaid falló para sub=${subscriptionId}: ${(err as Error).message}`);
    }
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

  /**
   * Lo que se persiste en `payments.method_data`. Para tarjeta (Mercantil) NUNCA guardamos
   * PAN/CVV/vencimiento: solo el tipo, la cédula, el tipo de cuenta y los últimos 4 dígitos
   * (para mostrar/auditar). El gateway sí recibe la tarjeta completa, en tránsito.
   */
  private sanitizeMethodDataForStorage(
    method: PaymentMethodKind,
    md: Record<string, unknown>,
  ): Record<string, unknown> {
    // Tarjetas: NUNCA persistir PAN/CVV/vencimiento. Para el segundo paso (finalize con OTP) el
    // navegador reenvía la tarjeta; en la fila sólo guardamos identificadores no sensibles + last4.
    const last4 = (v: unknown) => {
      const digits = String(v ?? '').replace(/\D/g, '');
      return digits.length >= 4 ? digits.slice(-4) : undefined;
    };

    if (method === 'card') {
      // Botón Mercantil.
      return {
        cardType: md.cardType,
        customerId: md.customerId,
        accountType: md.accountType,
        cardLast4: last4(md.cardNumber),
      };
    }

    if (method === 'card_ccr') {
      // Credicard (CCR). tipoDocumento/documentoCliente/cardHolderName/accountType no son
      // sensibles; PAN, cvc, monthExp y yearExp se descartan (los reenvía el navegador).
      return {
        tipoDocumento: md.tipoDocumento,
        documentoCliente: md.documentoCliente,
        cardHolderName: md.cardHolderName,
        accountType: md.accountType,
        cardLast4: last4(md.cardNumber),
      };
    }

    return md;
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
