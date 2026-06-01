import { ApiTags, ApiSecurity, ApiOperation, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import {
  Get,
  Body,
  Post,
  Param,
  Patch,
  Query,
  UseGuards,
  Controller,
  ParseUUIDPipe,
  ForbiddenException,
} from '@nestjs/common';

import { Subscription } from './domain/subscription';
import { ChangePlanDto } from './dto/change-plan.dto';
import { Invoice } from '@/modules/invoices/domain/invoice';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { CurrentApiKey } from '@/modules/auth-api-key/api-key.decorator';
import { ApiKeyAuthGuard } from '@/modules/auth-api-key/api-key-auth.guard';

type ApiKeyContext = { id: string; applicationId: string; scopes: string[]; publicId: string };

/**
 * Endpoints consumidos por SaaS (Vitriona, futuros).
 * Auth: header `X-CLIP-API-Key: <publicId>:<secret>`.
 * Cada operación está scoped a la `applicationId` de la API key.
 */
@ApiTags('SaaS — Subscriptions')
@ApiSecurity('apiKey')
@UseGuards(ApiKeyAuthGuard)
@Controller({ path: 'saas/subscriptions', version: '1' })
export class SaasSubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @ApiOperation({ summary: 'Crear suscripción.' })
  @ApiCreatedResponse({ type: Subscription })
  @Post()
  create(@CurrentApiKey() apiKey: ApiKeyContext, @Body() dto: CreateSubscriptionDto): Promise<Subscription> {
    this.requireScope(apiKey, 'subscriptions:write');
    return this.service.create(apiKey.applicationId, dto);
  }

  @ApiOperation({ summary: 'Detalle de suscripción.' })
  @ApiOkResponse({ type: Subscription })
  @Get(':id')
  async findOne(@CurrentApiKey() apiKey: ApiKeyContext, @Param('id', ParseUUIDPipe) id: string): Promise<Subscription> {
    this.requireScope(apiKey, 'subscriptions:read');
    const sub = await this.service.findById(id);
    this.assertOwnership(apiKey, sub.applicationId);
    return sub;
  }

  @ApiOperation({ summary: 'Buscar por externalSubscriptionId (ej: businessId del SaaS).' })
  @ApiOkResponse({ type: Subscription })
  @Get('lookup/external')
  async findByExternal(
    @CurrentApiKey() apiKey: ApiKeyContext,
    @Query('externalId') externalId: string,
  ): Promise<Subscription | null> {
    this.requireScope(apiKey, 'subscriptions:read');
    return this.service.findByExternalId(apiKey.applicationId, externalId);
  }

  @ApiOperation({
    summary: 'Iniciar renovación: genera Invoice + checkout token para el próximo período.',
    description: 'NO mueve el estado de la subscription hasta que el invoice se pague.',
  })
  @ApiOkResponse({ description: 'Invoice emitido para la renovación, con checkout_token incluido.', type: Invoice })
  @Post(':id/renew')
  async renew(
    @CurrentApiKey() apiKey: ApiKeyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ subscription: Subscription; invoice: Invoice }> {
    this.requireScope(apiKey, 'subscriptions:write');
    const sub = await this.service.findById(id);
    this.assertOwnership(apiKey, sub.applicationId);
    return this.service.renew(id, 'customer');
  }

  @ApiOperation({ summary: 'Cambiar plan (default: schedule al fin del período).' })
  @ApiOkResponse({ type: Subscription })
  @Patch(':id/plan')
  async changePlan(
    @CurrentApiKey() apiKey: ApiKeyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePlanDto,
  ): Promise<Subscription> {
    this.requireScope(apiKey, 'subscriptions:write');
    const sub = await this.service.findById(id);
    this.assertOwnership(apiKey, sub.applicationId);
    return this.service.changePlan(id, dto, 'customer');
  }

  @ApiOperation({ summary: 'Cancelar (default: al fin del período).' })
  @ApiOkResponse({ type: Subscription })
  @Post(':id/cancel')
  async cancel(
    @CurrentApiKey() apiKey: ApiKeyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<Subscription> {
    this.requireScope(apiKey, 'subscriptions:write');
    const sub = await this.service.findById(id);
    this.assertOwnership(apiKey, sub.applicationId);
    return this.service.cancel(id, dto, 'customer');
  }

  private requireScope(apiKey: ApiKeyContext, scope: string): void {
    if (!apiKey.scopes.includes(scope)) {
      throw new ForbiddenException(`API key no tiene el scope "${scope}".`);
    }
  }

  private assertOwnership(apiKey: ApiKeyContext, resourceApplicationId: string): void {
    if (apiKey.applicationId !== resourceApplicationId) {
      throw new ForbiddenException('La subscription pertenece a otra aplicación.');
    }
  }
}
