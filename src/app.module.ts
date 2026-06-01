import path from 'path';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { DataSource, DataSourceOptions } from 'typeorm';
import { I18nModule, HeaderResolver } from 'nestjs-i18n';
import { ConfigModule, ConfigService } from '@nestjs/config';

import appConfig from './config/app.config';
import { AllConfigType } from './config/config.type';
import paymentsConfig from './config/payments.config';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { HomeModule } from './modules/home/home.module';
import { BanksModule } from './modules/banks/banks.module';
import { UsersModule } from './modules/users/users.module';
import { FilesModule } from './modules/files/files.module';
import authConfig from './modules/auth/config/auth.config';
import mailConfig from './modules/mail/config/mail.config';
import fxConfig from './modules/fx-rates/config/fx.config';
import fileConfig from './modules/files/config/file.config';
import { CryptoModule } from './modules/crypto/crypto.module';
import { MailerModule } from './modules/mailer/mailer.module';
import databaseConfig from './database/config/database.config';
import { SessionModule } from './modules/session/session.module';
import appleConfig from './modules/auth-apple/config/apple.config';
import { FxRatesModule } from './modules/fx-rates/fx-rates.module';
import { ProductsModule } from './modules/products/products.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CountersModule } from './modules/counters/counters.module';
import googleConfig from './modules/auth-google/config/google.config';
import { CustomersModule } from './modules/customers/customers.module';
import sitefConfig from './modules/gateways/sitef/config/sitef.config';
import { AuthAppleModule } from './modules/auth-apple/auth-apple.module';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { AuthGoogleModule } from './modules/auth-google/auth-google.module';
import { AuthApiKeyModule } from './modules/auth-api-key/auth-api-key.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { CronLeaderModule } from './common/cron/cron-leader.module';
import { WebhooksOutgoingModule } from './modules/webhooks-outgoing/webhooks-outgoing.module';
import { MerchantTerminalsModule } from './modules/merchant-terminals/merchant-terminals.module';
import { PaymentReceivingAccountsModule } from './modules/payment-receiving-accounts/payment-receiving-accounts.module';

const infrastructureDatabaseModule = TypeOrmModule.forRootAsync({
  useClass: TypeOrmConfigService,
  dataSourceFactory: async (options: DataSourceOptions) => {
    return new DataSource(options).initialize();
  },
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        authConfig,
        appConfig,
        mailConfig,
        fileConfig,
        googleConfig,
        appleConfig,
        fxConfig,
        sitefConfig,
        paymentsConfig,
      ],
      envFilePath: ['.env'],
    }),
    infrastructureDatabaseModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: { url: process.env.WORKER_HOST },
      }),
    }),
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: { path: path.join(__dirname, '/i18n/'), watch: true },
      }),
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService<AllConfigType>) => {
            return [
              configService.get('app.headerLanguage', {
                infer: true,
              }),
            ];
          },
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    CronLeaderModule,
    CryptoModule,
    UsersModule,
    FilesModule,
    AuthModule,
    AuthGoogleModule,
    AuthAppleModule,
    SessionModule,
    MailModule,
    MailerModule,
    HomeModule,
    ApplicationsModule,
    BanksModule,
    FxRatesModule,
    CustomersModule,
    ProductsModule,
    CountersModule,
    MerchantTerminalsModule,
    InvoicesModule,
    WebhooksOutgoingModule,
    OutboxModule,
    AuthApiKeyModule,
    PaymentsModule,
    SubscriptionsModule,
    PaymentReceivingAccountsModule,
  ],
})
export class AppModule {}
