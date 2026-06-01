import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AllConfigType } from '@/config/config.type';

/**
 * Firma webhooks salientes con esquema estilo Stripe:
 *   X-CLIP-Signature: t=<timestamp>,v1=<hex hmac>
 * Donde `hmac = HMAC_SHA256(secret, "<timestamp>.<rawBody>")`.
 */
@Injectable()
export class WebhookSigner {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  sign(secret: string, rawBody: string, timestamp: number = Math.floor(Date.now() / 1000)): string {
    const version = this.configService.getOrThrow('payments.webhookSigningVersion', { infer: true });
    const sigInput = `${timestamp}.${rawBody}`;
    const hex = createHmac('sha256', secret).update(sigInput).digest('hex');
    return `t=${timestamp},${version}=${hex}`;
  }
}
