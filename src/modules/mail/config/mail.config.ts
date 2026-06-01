import { registerAs } from '@nestjs/config';
import { IsEmail, IsString } from 'class-validator';

import { MailConfig } from './mail-config.type';
import validateConfig from '@/common/utils/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  RESEND_API_KEY: string;

  @IsEmail()
  MAIL_DEFAULT_EMAIL: string;

  @IsString()
  MAIL_DEFAULT_NAME: string;
}

export default registerAs<MailConfig>('mail', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    defaultEmail: process.env.MAIL_DEFAULT_EMAIL ?? 'noreply@clisoftwarehouse.com',
    defaultName: process.env.MAIL_DEFAULT_NAME ?? 'CLI Payments',
  };
});
