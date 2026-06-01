import {
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  HttpCode,
  UseGuards,
  Controller,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';

import { PaymentReceivingAccount } from './domain/payment-receiving-account';
import { PaymentReceivingAccountsService } from './payment-receiving-accounts.service';
import { CreatePaymentReceivingAccountDto } from './dto/create-payment-receiving-account.dto';
import { UpdatePaymentReceivingAccountDto } from './dto/update-payment-receiving-account.dto';

@ApiTags('Payment Receiving Accounts (admin)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'payment-receiving-accounts', version: '1' })
export class PaymentReceivingAccountsController {
  constructor(private readonly service: PaymentReceivingAccountsService) {}

  @ApiOperation({ summary: 'Listar cuentas receptoras por aplicación.' })
  @ApiOkResponse({ type: PaymentReceivingAccount, isArray: true })
  @Get()
  list(
    @Query('applicationId') applicationId: string,
    @Query('method') method?: string,
  ): Promise<PaymentReceivingAccount[]> {
    return this.service.listByApplication(applicationId, method);
  }

  @ApiOperation({ summary: 'Crear nueva cuenta receptora.' })
  @ApiCreatedResponse({ type: PaymentReceivingAccount })
  @Post()
  create(@Body() dto: CreatePaymentReceivingAccountDto): Promise<PaymentReceivingAccount> {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Actualizar cuenta receptora.' })
  @ApiOkResponse({ type: PaymentReceivingAccount })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentReceivingAccountDto,
  ): Promise<PaymentReceivingAccount> {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Eliminar cuenta receptora.' })
  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
