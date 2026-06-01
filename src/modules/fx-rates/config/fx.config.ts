import { registerAs } from '@nestjs/config';
import { IsIn, IsInt, IsUrl, IsString, IsOptional } from 'class-validator';

import { FxConfig, FxSourceCode } from './fx-config.type';
import validateConfig from '@/common/utils/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  FX_CRON_SCHEDULE: string;

  @IsString()
  @IsOptional()
  FX_CRON_TIMEZONE: string;

  @IsIn(['DOLARAPI', 'YADIO', 'EXCHANGEDYN', 'MANUAL'])
  @IsOptional()
  FX_PRIMARY_SOURCE: FxSourceCode;

  @IsString()
  @IsOptional()
  FX_FALLBACK_SOURCES: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  FX_DOLARAPI_URL: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  FX_YADIO_URL: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  FX_EXCHANGEDYN_URL: string;

  @IsInt()
  @IsOptional()
  FX_STALE_HOURS_ALERT: number;
}

export default registerAs<FxConfig>('fx', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const fallbacks = (process.env.FX_FALLBACK_SOURCES ?? 'YADIO,EXCHANGEDYN')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is FxSourceCode => ['DOLARAPI', 'YADIO', 'EXCHANGEDYN', 'MANUAL'].includes(s));

  return {
    cronSchedule: process.env.FX_CRON_SCHEDULE ?? '0 */6 * * *',
    cronTimezone: process.env.FX_CRON_TIMEZONE ?? 'America/Caracas',
    primarySource: (process.env.FX_PRIMARY_SOURCE as FxSourceCode) ?? 'DOLARAPI',
    fallbackSources: fallbacks,
    dolarApiUrl: process.env.FX_DOLARAPI_URL ?? 'https://ve.dolarapi.com/v1',
    yadioUrl: process.env.FX_YADIO_URL ?? 'https://api.yadio.io/exrates/VES',
    exchangedynUrl: process.env.FX_EXCHANGEDYN_URL ?? 'https://api.exchangedyn.com/markets/quotes/eurves/spot',
    staleHoursAlert: process.env.FX_STALE_HOURS_ALERT ? parseInt(process.env.FX_STALE_HOURS_ALERT, 10) : 24,
  };
});
