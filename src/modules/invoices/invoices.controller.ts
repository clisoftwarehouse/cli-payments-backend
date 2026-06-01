import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiProduces, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse, ApiProperty } from '@nestjs/swagger';
import {
  Get,
  Res,
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

import { Invoice } from './domain/invoice';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { GeneratePaymentLinkDto } from './dto/generate-payment-link.dto';
import { CustomersService } from '@/modules/customers/customers.service';
import { ApplicationsService } from '@/modules/applications/applications.service';

class PaymentLinkResponse {
  @ApiProperty() invoice: Invoice;
  @ApiProperty({ description: 'URL pública de pago lista para enviar al cliente.' }) checkoutUrl: string;
}

@ApiTags('Invoices (admin)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdfService: InvoicePdfService,
    private readonly customersService: CustomersService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  @ApiOperation({ summary: 'Crear factura en estado draft.' })
  @ApiCreatedResponse({ type: Invoice })
  @Post()
  create(@Body() dto: CreateInvoiceDto): Promise<Invoice> {
    return this.invoicesService.createDraft(dto);
  }

  @ApiOperation({
    summary: 'Generar link de pago (cotización).',
    description:
      'Crea Customer (upsert) + Invoice (draft → open) en un solo paso y devuelve la URL de checkout lista para enviar al cliente.',
  })
  @ApiCreatedResponse({ type: PaymentLinkResponse })
  @Post('payment-link')
  async generatePaymentLink(@Body() dto: GeneratePaymentLinkDto): Promise<PaymentLinkResponse> {
    const customer = await this.customersService.upsert({
      email: dto.customer.email,
      fullName: dto.customer.fullName,
      phone: dto.customer.phone,
      country: 'VE',
      identityType: dto.customer.identityType,
      identityValue: dto.customer.identityValue,
    });

    const draft = await this.invoicesService.createDraft({
      applicationId: dto.applicationId,
      customerId: customer.id,
      displayCurrency: 'EUR',
      items: [{ description: dto.description, quantity: 1, unitAmountEur: dto.amount }],
      notes: dto.notes,
    });

    const invoice = await this.invoicesService.issue(draft.id);
    const baseUrl = process.env.CHECKOUT_BASE_URL ?? 'http://localhost:4321';
    const checkoutUrl = `${baseUrl}/pagar/${invoice.checkoutToken}`;

    return { invoice, checkoutUrl };
  }

  @ApiOperation({
    summary: 'Emitir factura: asigna número correlativo + checkout token + snapshot FX.',
    description:
      'Solo aplica a facturas en draft. Devuelve la factura con `checkoutToken` para construir el link de pago.',
  })
  @ApiOkResponse({ type: Invoice })
  @Post(':id/issue')
  issue(@Param('id', ParseUUIDPipe) id: string): Promise<Invoice> {
    return this.invoicesService.issue(id);
  }

  @ApiOkResponse({ type: Invoice, isArray: true })
  @Get()
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('applicationId') applicationId?: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: string,
  ): Promise<Invoice[]> {
    return this.invoicesService.list({ page, limit, applicationId, customerId, status });
  }

  @ApiOkResponse({ type: Invoice })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Invoice> {
    return this.invoicesService.findById(id);
  }

  @ApiOperation({ summary: 'Descargar PDF del recibo (genera on-demand).' })
  @ApiProduces('application/pdf')
  @Get(':id/pdf')
  async downloadPdf(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const invoice = await this.invoicesService.findById(id);
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
}
