import axios, { AxiosError } from 'axios';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Processor, WorkerHost } from '@nestjs/bullmq';

import { AllConfigType } from '@/config/config.type';
import { OutboxMapper } from './infrastructure/persistence/relational/mappers/outbox.mapper';
import { OutboxQueue, OUTBOX_QUEUE, DispatchJobData } from './outbox-queue.service';
import { WebhookSigner } from '@/modules/webhooks-outgoing/webhook-signer';
import { OutboxInternalHandlerRegistry } from './outbox-internal-handler.registry';
import { OutboxEventEntity } from './infrastructure/persistence/relational/entities/outbox-event.entity';
import { OutboxDeliveryEntity } from './infrastructure/persistence/relational/entities/outbox-delivery.entity';
import { WebhookEndpointEntity } from '@/modules/applications/infrastructure/persistence/relational/entities/webhook-endpoint.entity';

@Processor(OUTBOX_QUEUE)
export class OutboxDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxDispatchProcessor.name);

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly signer: WebhookSigner,
    private readonly queue: OutboxQueue,
    private readonly internalHandlers: OutboxInternalHandlerRegistry,
    @InjectRepository(OutboxEventEntity)
    private readonly eventsRepo: Repository<OutboxEventEntity>,
    @InjectRepository(OutboxDeliveryEntity)
    private readonly deliveriesRepo: Repository<OutboxDeliveryEntity>,
    @InjectRepository(WebhookEndpointEntity)
    private readonly endpointsRepo: Repository<WebhookEndpointEntity>,
  ) {
    super();
  }

  async process(job: Job<DispatchJobData>): Promise<void> {
    const delivery = await this.deliveriesRepo.findOne({ where: { id: job.data.deliveryId } });
    if (!delivery) {
      this.logger.warn(`Delivery ${job.data.deliveryId} no encontrado.`);
      return;
    }

    // Doble-dispatch guard: si otro worker ya la procesó o si terminó.
    if (delivery.status === 'delivered' || delivery.status === 'giving_up') {
      this.logger.debug(`Delivery ${delivery.id} ya en estado terminal (${delivery.status}). Skip.`);
      return;
    }

    // Marca 'delivering' antes del side-effect — el sweeper detecta crashed workers
    // si ve un row 'delivering' con updatedAt viejo.
    delivery.status = 'delivering';
    delivery.attempts += 1;
    await this.deliveriesRepo.save(delivery);

    const event = await this.eventsRepo.findOne({ where: { id: delivery.eventId } });
    if (!event) {
      this.logger.error(`Event ${delivery.eventId} faltante para delivery ${delivery.id}. Marcando giving_up.`);
      await this.markGivingUp(delivery, 'event_missing', 'Evento de outbox no encontrado.');
      return;
    }

    if (delivery.targetType === 'webhook_endpoint') {
      await this.dispatchWebhook(delivery, event);
    } else if (delivery.targetType === 'internal_handler') {
      await this.dispatchInternal(delivery, event);
    } else {
      this.logger.error(`Delivery ${delivery.id} con target_type desconocido: ${delivery.targetType}`);
      await this.markGivingUp(delivery, 'unknown_target_type', `target_type=${delivery.targetType}`);
    }
  }

  private async dispatchWebhook(delivery: OutboxDeliveryEntity, event: OutboxEventEntity): Promise<void> {
    if (!delivery.targetId) {
      await this.markGivingUp(delivery, 'missing_target_id', 'webhook_endpoint sin target_id.');
      return;
    }
    const endpoint = await this.endpointsRepo.findOne({ where: { id: delivery.targetId } });
    if (!endpoint || !endpoint.isActive) {
      await this.markGivingUp(delivery, 'endpoint_inactive', 'Endpoint eliminado o desactivado.');
      return;
    }

    const body = {
      type: event.eventKind,
      data: event.payload,
      occurred_at: event.createdAt.toISOString(),
      delivery_id: delivery.id,
      event_id: event.id,
    };
    const rawBody = JSON.stringify(body);
    const signature = this.signer.sign(endpoint.signingSecret, rawBody);

    try {
      const response = await axios.post(endpoint.url, rawBody, {
        timeout: 15_000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'cli-payments-webhooks/1.0',
          'X-CLIP-Event': event.eventKind,
          'X-CLIP-Signature': signature,
          'X-CLIP-Delivery-Id': delivery.id,
        },
        validateStatus: () => true,
      });

      delivery.lastResponseStatus = response.status;
      delivery.lastResponseBody =
        typeof response.data === 'string' ? response.data.slice(0, 2000) : JSON.stringify(response.data).slice(0, 2000);

      if (response.status >= 200 && response.status < 300) {
        await this.markDelivered(delivery);
        return;
      }

      await this.scheduleRetry(delivery, `http_${response.status}`, `HTTP ${response.status}`);
    } catch (err) {
      const ax = err as AxiosError;
      const code = ax.code ?? 'network_error';
      const message = ax.message ?? String(err);
      await this.scheduleRetry(delivery, code, message);
    }
  }

  private async dispatchInternal(delivery: OutboxDeliveryEntity, event: OutboxEventEntity): Promise<void> {
    if (!delivery.targetDescriptor) {
      await this.markGivingUp(delivery, 'missing_descriptor', 'internal_handler sin target_descriptor.');
      return;
    }
    if (!this.internalHandlers.has(delivery.targetDescriptor)) {
      // Handler no registrado — la app pidió emitir a un descriptor sin código que lo escuche.
      // Lo marcamos giving_up; el admin lo verá y puede registrar el handler o purgar.
      await this.markGivingUp(
        delivery,
        'unknown_handler',
        `No hay handler para descriptor="${delivery.targetDescriptor}". Registered: ${this.internalHandlers.listDescriptors().join(', ')}`,
      );
      return;
    }

    try {
      await this.internalHandlers.invoke(delivery.targetDescriptor, OutboxMapper.eventToDomain(event));
      await this.markDelivered(delivery);
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      await this.scheduleRetry(delivery, 'handler_error', message);
    }
  }

  private async markDelivered(delivery: OutboxDeliveryEntity): Promise<void> {
    delivery.status = 'delivered';
    delivery.deliveredAt = new Date();
    delivery.nextAttemptAt = null;
    delivery.lastErrorCode = null;
    delivery.lastErrorMessage = null;
    await this.deliveriesRepo.save(delivery);
  }

  private async markGivingUp(delivery: OutboxDeliveryEntity, code: string, message: string): Promise<void> {
    delivery.status = 'giving_up';
    delivery.givenUpAt = new Date();
    delivery.nextAttemptAt = null;
    delivery.lastErrorCode = code;
    delivery.lastErrorMessage = message;
    await this.deliveriesRepo.save(delivery);
  }

  private async scheduleRetry(delivery: OutboxDeliveryEntity, code: string, message: string): Promise<void> {
    delivery.lastErrorCode = code;
    delivery.lastErrorMessage = message;

    const schedule = this.configService.getOrThrow('payments.webhookRetryBackoffSeconds', { infer: true });
    const nextDelaySeconds = schedule[delivery.attempts - 1];

    if (nextDelaySeconds === undefined) {
      await this.markGivingUp(delivery, code, message);
      return;
    }

    delivery.status = 'pending';
    delivery.nextAttemptAt = new Date(Date.now() + nextDelaySeconds * 1000);
    await this.deliveriesRepo.save(delivery);

    await this.queue.dispatchDelayed(delivery.id, nextDelaySeconds * 1000);
  }
}
