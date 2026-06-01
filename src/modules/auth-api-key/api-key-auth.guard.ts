import { Repository } from 'typeorm';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, CanActivate, UnauthorizedException, type ExecutionContext } from '@nestjs/common';

import { CryptoService } from '@/modules/crypto/crypto.service';
import { ApiKeyEntity } from '@/modules/applications/infrastructure/persistence/relational/entities/api-key.entity';

export type ApiKeyRequest = Request & {
  apiKey?: {
    id: string;
    applicationId: string;
    scopes: string[];
    publicId: string;
  };
};

/**
 * Guard que autentica requests SaaS-to-SaaS.
 *
 * Header esperado: `X-CLIP-API-Key: pk_live_xxx:sk_live_yyy`
 *   - Parsea `publicId:secret`
 *   - Busca el row por `publicId`, valida que no esté revocado
 *   - Compara SHA-256(secret) con `secret_hash`
 *   - Si ok: adjunta `apiKey` al request y actualiza `last_used_at` (best-effort).
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly crypto: CryptoService,
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeysRepo: Repository<ApiKeyEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ApiKeyRequest>();
    const raw = req.header('x-clip-api-key') ?? req.header('X-CLIP-API-Key');

    if (!raw || typeof raw !== 'string') {
      throw new UnauthorizedException('Falta header X-CLIP-API-Key.');
    }

    const [publicId, secret] = raw.split(':');
    if (!publicId || !secret) {
      throw new UnauthorizedException('Formato de API key inválido. Esperado: <publicId>:<secret>.');
    }

    const entity = await this.apiKeysRepo.findOne({ where: { publicId } });
    if (!entity) {
      throw new UnauthorizedException('API key no encontrada.');
    }
    if (entity.revokedAt) {
      throw new UnauthorizedException('API key revocada.');
    }

    const hash = this.crypto.sha256(secret);
    if (hash !== entity.secretHash) {
      throw new UnauthorizedException('Secret inválido.');
    }

    req.apiKey = {
      id: entity.id,
      applicationId: entity.applicationId,
      scopes: entity.scopes ?? [],
      publicId: entity.publicId,
    };

    // Best-effort: actualizar lastUsedAt sin bloquear el request.
    this.apiKeysRepo.update(entity.id, { lastUsedAt: new Date() }).catch(() => undefined);

    return true;
  }
}
