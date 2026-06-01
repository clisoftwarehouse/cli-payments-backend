import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiProperty } from '@nestjs/swagger';
import {
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Controller,
  ParseIntPipe,
  ParseUUIDPipe,
  DefaultValuePipe,
} from '@nestjs/common';

import { SubscriptionsService } from './subscriptions.service';
import { Subscription, SubscriptionEvent } from './domain/subscription';

class ResendWebhookResult {
  @ApiProperty({ description: 'IDs de las entregas encoladas. Vacío si no hay suscriptores configurados.' })
  deliveryIds: string[];
}

@ApiTags('Subscriptions (admin)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @ApiOperation({ summary: 'Listar suscripciones (admin).' })
  @ApiOkResponse({ type: Subscription, isArray: true })
  @Get()
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('applicationId') applicationId?: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ): Promise<Subscription[]> {
    return this.service.list({ page, limit, applicationId, customerId, status });
  }

  @ApiOkResponse({ type: Subscription })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Subscription> {
    return this.service.findById(id);
  }

  @ApiOperation({ summary: 'Historial de eventos de la suscripción (auditoría).' })
  @ApiOkResponse({ type: SubscriptionEvent, isArray: true })
  @Get(':id/events')
  events(@Param('id', ParseUUIDPipe) id: string): Promise<SubscriptionEvent[]> {
    return this.service.listEvents(id);
  }

  @ApiOperation({
    summary: 'Re-enviar webhook subscription.renewed (recuperación manual).',
    description:
      'Re-emite el evento subscription.renewed con el estado actual de la suscripción sin modificar el período ni cobrar al cliente. ' +
      'Útil cuando el webhook original no se entregó (suscriptor no registrado, caída de red, etc.).',
  })
  @ApiOkResponse({ type: ResendWebhookResult })
  @Post(':id/resend-webhook')
  resendWebhook(@Param('id', ParseUUIDPipe) id: string): Promise<ResendWebhookResult> {
    return this.service.resendRenewedWebhook(id);
  }
}
