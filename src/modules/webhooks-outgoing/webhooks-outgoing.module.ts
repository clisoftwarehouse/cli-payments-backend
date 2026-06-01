import { Module } from '@nestjs/common';

import { WebhookSigner } from './webhook-signer';

/**
 * Provee `WebhookSigner` para firmar webhooks salientes con HMAC-SHA256.
 *
 * Histórico: este módulo también tenía `WebhookDispatcherService` y
 * `WebhookDeliveryProcessor`, que fueron reemplazados por el OutboxModule
 * (eventos firmados via outbox_event + outbox_delivery con retries y dead-letter).
 * La tabla `webhook_delivery` queda en DB para forensics de datos viejos pero
 * no recibe escrituras nuevas.
 */
@Module({
  providers: [WebhookSigner],
  exports: [WebhookSigner],
})
export class WebhooksOutgoingModule {}
