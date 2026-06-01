import { ApiTags, ApiSecurity, ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { Body, Post, UseGuards, Controller, ForbiddenException } from '@nestjs/common';

import { Customer } from './domain/customer';
import { CustomersService } from './customers.service';
import { UpsertCustomerDto } from './dto/upsert-customer.dto';
import { CurrentApiKey } from '@/modules/auth-api-key/api-key.decorator';
import { ApiKeyAuthGuard } from '@/modules/auth-api-key/api-key-auth.guard';

type ApiKeyContext = { id: string; applicationId: string; scopes: string[]; publicId: string };

/**
 * Endpoints de customers consumidos por SaaS (Vitriona, futuros).
 * Auth: header `X-CLIP-API-Key: <publicId>:<secret>`.
 * Los customers son cross-app (únicos por email+país), pero requerimos scope `customers:write`
 * para registrarlos desde un SaaS.
 */
@ApiTags('SaaS — Customers')
@ApiSecurity('apiKey')
@UseGuards(ApiKeyAuthGuard)
@Controller({ path: 'saas/customers', version: '1' })
export class SaasCustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @ApiOperation({ summary: 'Crear o actualizar un customer (idempotente por email+país).' })
  @ApiCreatedResponse({ type: Customer })
  @Post()
  upsert(@CurrentApiKey() apiKey: ApiKeyContext, @Body() dto: UpsertCustomerDto): Promise<Customer> {
    this.requireScope(apiKey, 'customers:write');
    return this.customersService.upsert(dto);
  }

  private requireScope(apiKey: ApiKeyContext, scope: string): void {
    if (!apiKey.scopes.includes(scope)) {
      throw new ForbiddenException(`API key no tiene el scope "${scope}".`);
    }
  }
}
