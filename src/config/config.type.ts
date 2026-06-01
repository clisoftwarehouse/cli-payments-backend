import { AppConfig } from './app-config.type';
import { PaymentsConfig } from './payments-config.type';
import { AuthConfig } from '../modules/auth/config/auth-config.type';
import { MailConfig } from '../modules/mail/config/mail-config.type';
import { FxConfig } from '../modules/fx-rates/config/fx-config.type';
import { FileConfig } from '../modules/files/config/file-config.type';
import { DatabaseConfig } from '../database/config/database-config.type';
import { AppleConfig } from '../modules/auth-apple/config/apple-config.type';
import { GoogleConfig } from '../modules/auth-google/config/google-config.type';
import { SitefConfig } from '../modules/gateways/sitef/config/sitef-config.type';

export type AllConfigType = {
  app: AppConfig;
  apple: AppleConfig;
  auth: AuthConfig;
  database: DatabaseConfig;
  file: FileConfig;
  fx: FxConfig;
  google: GoogleConfig;
  mail: MailConfig;
  payments: PaymentsConfig;
  sitef: SitefConfig;
};
