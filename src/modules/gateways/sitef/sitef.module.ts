import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SitefClient } from './sitef.client';
import { SitefAdapter } from './sitef.adapter';
import sitefConfig from './config/sitef.config';
import { SitefAuthService } from './sitef-auth.service';
import { PaymentGatewayPort } from './payment-gateway.port';
import { MerchantTerminalsModule } from '@/modules/merchant-terminals/merchant-terminals.module';

@Module({
  imports: [ConfigModule.forFeature(sitefConfig), MerchantTerminalsModule],
  providers: [SitefAuthService, SitefClient, SitefAdapter, { provide: PaymentGatewayPort, useExisting: SitefAdapter }],
  exports: [PaymentGatewayPort],
})
export class SitefModule {}
