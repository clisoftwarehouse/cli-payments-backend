import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';

import { AllConfigType } from '@/config/config.type';

type TokenPayload = {
  iid: string; // invoice id
  exp: number; // unix seconds
};

@Injectable()
export class CheckoutTokenService {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  /** Devuelve `{ token, expiresAt }`. El token es base64url(payload).base64url(hmac). */
  sign(invoiceId: string): { token: string; expiresAt: Date } {
    const ttl = this.parseDuration(this.configService.getOrThrow('payments.checkoutTokenExpiresIn', { infer: true }));
    const expSeconds = Math.floor(Date.now() / 1000) + ttl;
    const payload: TokenPayload = { iid: invoiceId, exp: expSeconds };
    const payloadB64 = this.b64url(Buffer.from(JSON.stringify(payload)));
    const sig = this.b64url(this.hmac(payloadB64));
    return { token: `${payloadB64}.${sig}`, expiresAt: new Date(expSeconds * 1000) };
  }

  /** Verifica firma + expiración; devuelve invoiceId. */
  verify(token: string): string {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) throw new UnauthorizedException('Token inválido.');

    const expected = this.b64url(this.hmac(payloadB64));
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Firma inválida.');
    }

    let payload: TokenPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Payload inválido.');
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token expirado.');
    }
    return payload.iid;
  }

  private hmac(data: string): Buffer {
    const secret = this.configService.getOrThrow('payments.checkoutTokenSecret', { infer: true });
    return createHmac('sha256', secret).update(data).digest();
  }

  private b64url(buf: Buffer): string {
    return buf.toString('base64url');
  }

  /** Parsea formato simple como "7d", "2h", "30m". */
  private parseDuration(value: string): number {
    const m = value.match(/^(\d+)([smhd])$/);
    if (!m) throw new Error(`Duración inválida: ${value}`);
    const n = parseInt(m[1], 10);
    switch (m[2]) {
      case 's':
        return n;
      case 'm':
        return n * 60;
      case 'h':
        return n * 3600;
      case 'd':
        return n * 86400;
      default:
        throw new Error(`Unidad inválida: ${m[2]}`);
    }
  }
}
