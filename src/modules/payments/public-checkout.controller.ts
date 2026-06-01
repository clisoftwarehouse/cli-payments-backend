import type { Response } from 'express';
import { ApiTags, ApiProduces, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Get, Res, Body, Post, Param, Query, Controller, BadRequestException } from '@nestjs/common';

import { Payment } from './domain/payment';
import { SubmitOtpDto } from './dto/submit-otp.dto';
import { PaymentsService } from './payments.service';
import { Invoice } from '@/modules/invoices/domain/invoice';
import { CreatePaymentBodyDto } from './dto/create-payment.dto';
import { InvoicesService } from '@/modules/invoices/invoices.service';
import { CustomersService } from '@/modules/customers/customers.service';
import { InvoicePdfService } from '@/modules/invoices/invoice-pdf.service';
import { ApplicationsService } from '@/modules/applications/applications.service';
import { PaymentReceivingAccount } from '@/modules/payment-receiving-accounts/domain/payment-receiving-account';
import { PaymentReceivingAccountsService } from '@/modules/payment-receiving-accounts/payment-receiving-accounts.service';

@ApiTags('Public Checkout')
@Controller({ path: 'public/checkouts', version: '1' })
export class PublicCheckoutController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
    private readonly pdfService: InvoicePdfService,
    private readonly customersService: CustomersService,
    private readonly applicationsService: ApplicationsService,
    private readonly receivingAccounts: PaymentReceivingAccountsService,
  ) {}

  @ApiOperation({
    summary: 'Detalle del checkout (sin auth — protegido por token firmado HMAC).',
    description: 'La landing renderiza el formulario con esta info: items + montos en EUR y VES equivalente.',
  })
  @ApiOkResponse({ type: Invoice })
  @Get(':token')
  async getCheckout(@Param('token') token: string): Promise<Invoice> {
    return this.invoices.findByCheckoutToken(token);
  }

  @ApiOperation({
    summary: 'Iniciar un pago contra el checkout (token-auth).',
    description:
      'C2P → devuelve requires_otp. Web Button → devuelve requires_action con redirectUrl. Transfer → succeeded o failed síncrono. Zelle → pending (admin confirma manualmente).',
  })
  @ApiOkResponse({ type: Payment })
  @Post(':token/payments')
  async createPayment(@Param('token') token: string, @Body() dto: CreatePaymentBodyDto): Promise<Payment> {
    const invoice = await this.invoices.findByCheckoutToken(token);
    if (!invoice) throw new BadRequestException('Checkout inválido o expirado.');
    return this.payments.createForInvoice(invoice.id, dto);
  }

  @ApiOperation({ summary: 'Submit OTP para confirmar un pago C2P.' })
  @ApiOkResponse({ type: Payment })
  @Post(':token/payments/:paymentId/otp')
  async submitOtp(
    @Param('token') token: string,
    @Param('paymentId') paymentId: string,
    @Body() dto: SubmitOtpDto,
  ): Promise<Payment> {
    // Validamos token (verify ya hace verify y throw si inválido)
    await this.invoices.findByCheckoutToken(token);
    return this.payments.submitOtp(paymentId, dto.otp);
  }

  @ApiOperation({ summary: 'Consultar status del pago (la landing polea hasta succeeded/failed).' })
  @ApiOkResponse({ type: Payment })
  @Get(':token/payments/:paymentId')
  async getStatus(@Param('token') token: string, @Param('paymentId') paymentId: string): Promise<Payment> {
    await this.invoices.findByCheckoutToken(token);
    return this.payments.findById(paymentId);
  }

  @ApiOperation({ summary: 'Descargar recibo PDF (token-auth, cliente final).' })
  @ApiProduces('application/pdf')
  @Get(':token/pdf')
  async downloadPdf(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const invoice = await this.invoices.findByCheckoutToken(token);
    const [customer, application] = await Promise.all([
      this.customersService.findById(invoice.customerId),
      this.applicationsService.findById(invoice.applicationId),
    ]);

    const buffer = await this.pdfService.generate(invoice, customer, application);
    const fileName = `${invoice.number ?? invoice.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(buffer);
  }

  @ApiOperation({ summary: 'Cuentas bancarias receptoras para el método indicado (sin auth).' })
  @ApiOkResponse({ type: PaymentReceivingAccount, isArray: true })
  @Get(':token/payment-accounts')
  async getPaymentAccounts(
    @Param('token') token: string,
    @Query('method') method?: string,
  ): Promise<PaymentReceivingAccount[]> {
    const invoice = await this.invoices.findByCheckoutToken(token);
    return this.receivingAccounts.listActiveByApplication(invoice.applicationId, method);
  }
}
