import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Logger, Injectable, UnauthorizedException } from '@nestjs/common';

import { SitefTokenResponse } from './sitef.types';
import { AllConfigType } from '@/config/config.type';
import { SitefConfig } from './config/sitef-config.type';
import { CryptoService } from '@/modules/crypto/crypto.service';

type CacheEntry = { token: string; expiresAt: number };

@Injectable()
export class SitefAuthService {
  private readonly logger = new Logger(SitefAuthService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * Obtiene un Bearer token Sitef. Devuelve el string completo (incluye "Bearer ").
   * Honra `SITEF_TOKEN_STRATEGY`: `per_request` siempre genera nuevo, `cached` reusa hasta TTL.
   */
  async getToken(username: string, plainPassword: string): Promise<string> {
    const config = this.configService.getOrThrow<SitefConfig>('sitef', { infer: true });

    if (config.tokenStrategy === 'cached') {
      const cached = this.cache.get(username);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.token;
      }
    }

    const token = await this.fetchNewToken(config.baseUrl, username, plainPassword, config.timeoutMs);

    if (config.tokenStrategy === 'cached') {
      this.cache.set(username, {
        token,
        expiresAt: Date.now() + config.tokenCacheTtlSeconds * 1000,
      });
    }

    return token;
  }

  private async fetchNewToken(
    baseUrl: string,
    username: string,
    plainPassword: string,
    timeoutMs: number,
  ): Promise<string> {
    const url = `${baseUrl}/s4/sitef/apiToken`;

    try {
      const response = await axios.post<SitefTokenResponse>(
        url,
        { username, password: this.crypto.md5(plainPassword) },
        { timeout: timeoutMs, headers: { 'Content-Type': 'application/json' } },
      );

      const token = response.data?.data?.token;
      if (!token) {
        throw new UnauthorizedException('Sitef /apiToken no devolvió token.');
      }
      return token;
    } catch (err) {
      this.logger.error(`Sitef auth failed for ${username}: ${(err as Error).message}`);
      throw new UnauthorizedException('No se pudo autenticar contra Sitef.');
    }
  }

  /** Genera el campo `token` del body (MD5 del Bearer completo). */
  bodyTokenFromBearer(bearer: string): string {
    return this.crypto.md5(bearer);
  }
}
