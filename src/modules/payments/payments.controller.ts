import { Repository } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import {
  Get,
  Body,
  Post,
  Param,
  Query,
  UseGuards,
  Controller,
  ParseIntPipe,
  ParseUUIDPipe,
  DefaultValuePipe,
} from '@nestjs/common';

import { PaymentsService } from './payments.service';
import { ManualGrantDto } from './dto/manual-grant.dto';
import { ManualVerifyDto } from './dto/manual-verify.dto';
import { Payment, PaymentAttempt } from './domain/payment';
import { PaymentEntity } from './infrastructure/persistence/relational/entities/payment.entity';
import { PaymentAttemptEntity } from './infrastructure/persistence/relational/entities/payment-attempt.entity';

@ApiTags('Payments (admin)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    @InjectRepository(PaymentEntity)
    private readonly paymentsRepo: Repository<PaymentEntity>,
    @InjectRepository(PaymentAttemptEntity)
    private readonly attemptsRepo: Repository<PaymentAttemptEntity>,
  ) {}

  @ApiOperation({ summary: 'Listar pagos.' })
  @ApiOkResponse({ type: Payment, isArray: true })
  @Get()
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('applicationId') applicationId?: string,
    @Query('status') status?: string,
  ): Promise<Payment[]> {
    const where: Record<string, unknown> = {};
    if (applicationId) where.applicationId = applicationId;
    if (status) where.status = status;

    const entities = await this.paymentsRepo.find({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return entities.map((e) => Object.assign(new Payment(), e) as Payment);
  }

  @ApiOperation({ summary: 'Detalle de un pago.' })
  @ApiOkResponse({ type: Payment })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Payment> {
    return this.paymentsService.findById(id);
  }

  @ApiOperation({ summary: 'Listar intentos de un pago (request/response Sitef enmascarados).' })
  @ApiOkResponse({ type: PaymentAttempt, isArray: true })
  @Get(':id/attempts')
  async listAttempts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<PaymentAttempt[]> {
    const attempts = await this.attemptsRepo.find({
      where: { paymentId: id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return attempts.map((a) => Object.assign(new PaymentAttempt(), a) as PaymentAttempt);
  }

  @ApiOperation({
    summary: 'Verificación manual de un pago por referencia contra Sitef (transfer / pago_movil).',
    description: 'Para cuando el cliente ya pagó pero falló la verificación automática. En éxito otorga la factura/suscripción.',
  })
  @ApiOkResponse({ type: Payment })
  @Post('verify')
  verify(@Body() dto: ManualVerifyDto): Promise<Payment> {
    return this.paymentsService.verifyForInvoice(dto.invoiceId, dto.method, dto.methodData);
  }

  @ApiOperation({
    summary: 'Otorgar (force-grant) una factura sin cobrar — requiere motivo (auditoría).',
    description: 'Marca la factura pagada y dispara la activación (suscripción si aplica). Para errores/pruebas donde Sitef no valida.',
  })
  @ApiOkResponse({ type: Payment })
  @Post('grant')
  grant(@Body() dto: ManualGrantDto): Promise<Payment> {
    return this.paymentsService.grantManually(dto.invoiceId, dto.reason);
  }
}
