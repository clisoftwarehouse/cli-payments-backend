import { registerAs } from '@nestjs/config';
import { IsIn, IsInt, IsUrl, IsString, IsOptional } from 'class-validator';

import validateConfig from '@/common/utils/validate-config';
import { SitefConfig, SitefTokenStrategy } from './sitef-config.type';

class EnvironmentVariablesValidator {
  @IsUrl({ require_tld: false })
  @IsOptional()
  SITEF_BASE_URL: string;

  @IsIn(['per_request', 'cached'])
  @IsOptional()
  SITEF_TOKEN_STRATEGY: SitefTokenStrategy;

  @IsInt()
  @IsOptional()
  SITEF_TOKEN_CACHE_TTL_SECONDS: number;

  @IsString()
  @IsOptional()
  SITEF_DEFAULT_CURRENCY: string;

  @IsInt()
  @IsOptional()
  SITEF_TIMEOUT_MS: number;
}

export default registerAs<SitefConfig>('sitef', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    baseUrl: process.env.SITEF_BASE_URL ?? 'https://api.sitefdevenezuela.com/prod',
    tokenStrategy: (process.env.SITEF_TOKEN_STRATEGY as SitefTokenStrategy) ?? 'per_request',
    tokenCacheTtlSeconds: process.env.SITEF_TOKEN_CACHE_TTL_SECONDS
      ? parseInt(process.env.SITEF_TOKEN_CACHE_TTL_SECONDS, 10)
      : 540,
    defaultCurrency: process.env.SITEF_DEFAULT_CURRENCY ?? 'VES',
    // Default 90s — la confirmación OTP de C2P valida contra el banco emisor (BDV, Banesco, etc.)
    // y rutinariamente toma 30-60s. Subir si tu banco es particularmente lento.
    timeoutMs: process.env.SITEF_TIMEOUT_MS ? parseInt(process.env.SITEF_TIMEOUT_MS, 10) : 90_000,
  };
});
