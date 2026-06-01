import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiTags, ApiOkResponse, ApiOperation, ApiBearerAuth, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  Controller,
  ParseIntPipe,
  ParseUUIDPipe,
  DefaultValuePipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { OutboxQueue } from './outbox-queue.service';
import { OutboxEvent } from './domain/outbox-event';
import { OutboxDelivery } from './domain/outbox-delivery';
import { OutboxInternalHandlerRegistry } from './outbox-internal-handler.registry';
import { OutboxMapper } from './infrastructure/persistence/relational/mappers/outbox.mapper';
import { OutboxEventEntity } from './infrastructure/persistence/relational/entities/outbox-event.entity';
import { OutboxDeliveryEntity } from './infrastructure/persistence/relational/entities/outbox-delivery.entity';

export class OutboxDeliveryDetail {
  @ApiPropertyOptional()
  event: OutboxEvent;

  @ApiPropertyOptional()
  delivery: OutboxDelivery;
}

@ApiTags('Outbox (admin)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'admin/outbox', version: '1' })
export class OutboxController {
  constructor(
    private readonly queue: OutboxQueue,
    private readonly handlerRegistry: OutboxInternalHandlerRegistry,
    @InjectRepository(OutboxEventEntity)
    private readonly eventsRepo: Repository<OutboxEventEntity>,
    @InjectRepository(OutboxDeliveryEntity)
    private readonly deliveriesRepo: Repository<OutboxDeliveryEntity>,
  ) {}

  @ApiOperation({
    summary: 'Lista deliveries del outbox con filtros — admin dashboard de webhooks/emails.',
  })
  @ApiOkResponse({ type: OutboxDelivery, isArray: true })
  @Get('deliveries')
  async listDeliveries(
    @Query('status') status?: string,
    @Query('target_type') targetType?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ): Promise<OutboxDelivery[]> {
    const qb = this.deliveriesRepo.createQueryBuilder('d').orderBy('d.updatedAt', 'DESC');
    if (status) qb.andWhere('d.status = :status', { status });
    if (targetType) qb.andWhere('d.target_type = :targetType', { targetType });
    qb.take(Math.min(limit ?? 50, 200)).skip(offset ?? 0);
    const rows = await qb.getMany();
    return rows.map(OutboxMapper.deliveryToDomain);
  }

  @ApiOperation({ summary: 'Detalle de una delivery + evento asociado.' })
  @ApiOkResponse({ type: OutboxDeliveryDetail })
  @Get('deliveries/:id')
  async findDelivery(@Param('id', ParseUUIDPipe) id: string): Promise<OutboxDeliveryDetail> {
    const delivery = await this.deliveriesRepo.findOne({ where: { id } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    const event = await this.eventsRepo.findOne({ where: { id: delivery.eventId } });
    if (!event) throw new NotFoundException('Event not found for delivery');
    return {
      event: OutboxMapper.eventToDomain(event),
      delivery: OutboxMapper.deliveryToDomain(delivery),
    };
  }

  @ApiOperation({
    summary: 'Re-encola una delivery (reset a pending + dispatch inmediato).',
    description:
      'Útil para deliveries en `giving_up`: el admin investiga, corrige el endpoint o el handler, y dispara este endpoint para reintentar. Resetea `attempts=0` y `next_attempt_at=now`.',
  })
  @ApiOkResponse({ type: OutboxDelivery })
  @Post('deliveries/:id/replay')
  async replayDelivery(@Param('id', ParseUUIDPipe) id: string): Promise<OutboxDelivery> {
    const delivery = await this.deliveriesRepo.findOne({ where: { id } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.status === 'delivered') {
      throw new BadRequestException('Delivery ya entregada — no requiere replay.');
    }

    delivery.status = 'pending';
    delivery.attempts = 0;
    delivery.nextAttemptAt = new Date();
    delivery.lastErrorCode = null;
    delivery.lastErrorMessage = null;
    delivery.givenUpAt = null;
    const saved = await this.deliveriesRepo.save(delivery);

    await this.queue.dispatch(saved.id);
    return OutboxMapper.deliveryToDomain(saved);
  }

  @ApiOperation({ summary: 'Detalle de un evento + sus deliveries.' })
  @Get('events/:id')
  async findEvent(@Param('id', ParseUUIDPipe) id: string): Promise<{
    event: OutboxEvent;
    deliveries: OutboxDelivery[];
  }> {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    const deliveries = await this.deliveriesRepo.find({
      where: { eventId: id },
      order: { createdAt: 'ASC' },
    });
    return {
      event: OutboxMapper.eventToDomain(event),
      deliveries: deliveries.map(OutboxMapper.deliveryToDomain),
    };
  }

  @ApiOperation({ summary: 'Lista los handlers internos registrados (debug).' })
  @Get('internal-handlers')
  listHandlers(): { descriptors: string[] } {
    return { descriptors: this.handlerRegistry.listDescriptors() };
  }
}
