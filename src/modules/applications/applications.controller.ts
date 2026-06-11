import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import {
  Get,
  Body,
  Post,
  Param,
  Patch,
  Query,
  Delete,
  HttpCode,
  UseGuards,
  HttpStatus,
  Controller,
  ParseIntPipe,
  ParseUUIDPipe,
  DefaultValuePipe,
} from '@nestjs/common';

import { Application } from './domain/application';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKey, ApiKeyWithSecret } from './domain/api-key';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';
import { WebhookEndpoint, WebhookEndpointWithSecret } from './domain/webhook-endpoint';

@ApiTags('Applications (admin)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'applications', version: '1' })
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @ApiOperation({ summary: 'Registrar un nuevo SaaS / landing consumidor de la API.' })
  @ApiCreatedResponse({ type: Application })
  @Post()
  create(@Body() dto: CreateApplicationDto): Promise<Application> {
    return this.applicationsService.create(dto);
  }

  @ApiOperation({ summary: 'Listar aplicaciones registradas.' })
  @ApiOkResponse({ type: Application, isArray: true })
  @Get()
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<Application[]> {
    return this.applicationsService.list({ page, limit });
  }

  @ApiOperation({ summary: 'Detalle de una aplicación.' })
  @ApiOkResponse({ type: Application })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Application> {
    return this.applicationsService.findById(id);
  }

  @ApiOperation({ summary: 'Actualizar metadata de la aplicación.' })
  @ApiOkResponse({ type: Application })
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApplicationDto): Promise<Application> {
    return this.applicationsService.update(id, dto);
  }

  @ApiOperation({
    summary: 'Generar API key para una aplicación.',
    description: 'IMPORTANTE: el campo `secret` se muestra UNA SOLA VEZ en esta respuesta. Guárdalo de forma segura.',
  })
  @ApiCreatedResponse({ type: ApiKeyWithSecret })
  @Post(':id/api-keys')
  createApiKey(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateApiKeyDto): Promise<ApiKeyWithSecret> {
    return this.applicationsService.createApiKey(id, dto);
  }

  @ApiOperation({ summary: 'Listar API keys de la aplicación (sin secret).' })
  @ApiOkResponse({ type: ApiKey, isArray: true })
  @Get(':id/api-keys')
  listApiKeys(@Param('id', ParseUUIDPipe) id: string): Promise<ApiKey[]> {
    return this.applicationsService.listApiKeys(id);
  }

  @ApiOperation({ summary: 'Revocar una API key (no se puede deshacer).' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('api-keys/:keyId')
  revokeApiKey(@Param('keyId', ParseUUIDPipe) keyId: string): Promise<void> {
    return this.applicationsService.revokeApiKey(keyId);
  }

  @ApiOperation({
    summary: 'Registrar webhook endpoint.',
    description: 'IMPORTANTE: `signingSecret` se devuelve UNA SOLA VEZ. Úsalo para validar X-CLIP-Signature.',
  })
  @ApiCreatedResponse({ type: WebhookEndpointWithSecret })
  @Post(':id/webhook-endpoints')
  createWebhookEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWebhookEndpointDto,
  ): Promise<WebhookEndpointWithSecret> {
    return this.applicationsService.createWebhookEndpoint(id, dto);
  }

  @ApiOperation({ summary: 'Listar webhook endpoints registrados.' })
  @ApiOkResponse({ type: WebhookEndpoint, isArray: true })
  @Get(':id/webhook-endpoints')
  listWebhookEndpoints(@Param('id', ParseUUIDPipe) id: string): Promise<WebhookEndpoint[]> {
    return this.applicationsService.listWebhookEndpoints(id);
  }

  @ApiOperation({ summary: 'Actualizar webhook endpoint: URL, eventos o activar/desactivar (sin borrar).' })
  @ApiOkResponse({ type: WebhookEndpoint })
  @Patch('webhook-endpoints/:id')
  updateWebhookEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookEndpointDto,
  ): Promise<WebhookEndpoint> {
    return this.applicationsService.updateWebhookEndpoint(id, dto);
  }
}
