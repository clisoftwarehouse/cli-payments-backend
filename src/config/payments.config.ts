import { registerAs } from '@nestjs/config';
import { Length, IsString, IsOptional } from 'class-validator';

import { PaymentsConfig } from './payments-config.type';
import validateConfig from '@/common/utils/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @Length(64, 64, { message: 'APP_ENCRYPTION_KEY debe ser 32 bytes en hex (64 chars).' })
  APP_ENCRYPTION_KEY: string;

  @IsString()
  @Length(32, 256)
  APP_CHECKOUT_TOKEN_SECRET: string;

  @IsString()
  @IsOptional()
  APP_CHECKOUT_TOKEN_EXPIRES_IN: string;
}

const parseList = (raw: string | undefined, fallback: number[]): number[] => {
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
};

export default registerAs<PaymentsConfig>('payments', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    encryptionKey: process.env.APP_ENCRYPTION_KEY!,
    checkoutTokenSecret: process.env.APP_CHECKOUT_TOKEN_SECRET!,
    checkoutTokenExpiresIn: process.env.APP_CHECKOUT_TOKEN_EXPIRES_IN ?? '7d',
    checkoutBaseUrl: process.env.CHECKOUT_BASE_URL ?? 'http://localhost:4321',
    rateLimitPerHour: process.env.PAYMENTS_RATE_LIMIT_PER_HOUR
      ? parseInt(process.env.PAYMENTS_RATE_LIMIT_PER_HOUR, 10)
      : 5,
    webhookSigningVersion: process.env.WEBHOOK_SIGNING_VERSION ?? 'v1',
    webhookRetryBackoffSeconds: parseList(process.env.WEBHOOK_RETRY_BACKOFF_SECONDS, [10, 30, 120, 600, 3600]),
    pollingBackoffSeconds: parseList(process.env.PAYMENTS_POLLING_BACKOFF_SECONDS, [5, 15, 45, 120, 300, 900, 1800]),
  };
});
