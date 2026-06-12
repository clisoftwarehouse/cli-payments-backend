import { Logger, Injectable, BadRequestException } from '@nestjs/common';

import { SitefClient } from './sitef.client';
import { Money, MoneyError } from '@/common/money/money';
import {
  SitefCredentials,
  SitefOperationResponse,
  SitefTransactionC2pResponse,
  SitefCcrCreateResponse,
  SitefCcrFinalizeResponse,
} from './sitef.types';
import { MerchantTerminalsService } from '@/modules/merchant-terminals/merchant-terminals.service';
import {
  GetStatusInput,
  SubmitOtpInput,
  CreatePaymentInput,
  PaymentGatewayPort,
  CreatePaymentResult,
  GatewayStatusResult,
} from './payment-gateway.port';

type MethodData = Record<string, unknown>;

@Injectable()
export class SitefAdapter extends PaymentGatewayPort {
  private readonly logger = new Logger(SitefAdapter.name);

  constructor(
    private readonly client: SitefClient,
    private readonly terminals: MerchantTerminalsService,
  ) {
    super();
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const creds = await this.resolveCreds(input.applicationId);
    const amount = this.parseAmount(input.amount);

    switch (input.method) {
      case 'c2p':
        return this.c2pRequestOtp(creds, input.invoiceNumber, amount, input.methodData);
      case 'transfer':
        return this.transfer(creds, input.invoiceNumber, amount, input.methodData);
      case 'pago_movil':
        return this.pagoMovil(creds, input.invoiceNumber, amount, input.methodData);
      case 'card_ccr':
        return this.cardCcrCreate(creds, amount, input.methodData);
      case 'web_button':
        return this.webButton(creds, input.invoiceNumber, amount, input.methodData);
      default:
        throw new BadRequestException(`Método ${input.method} no soportado por SitefAdapter.`);
    }
  }

  async submitOtp(input: SubmitOtpInput): Promise<CreatePaymentResult> {
    const creds = await this.resolveCreds(input.applicationId);
    const amount = this.parseAmount(input.amount);
    if (input.method === 'card_ccr') {
      return this.cardCcrFinalize(creds, amount, input.otp, input.methodData);
    }
    return this.c2pExecuteWithOtp(creds, input.invoiceNumber, amount, input.otp, input.methodData);
  }

  async getStatus(input: GetStatusInput): Promise<GatewayStatusResult> {
    const creds = await this.resolveCreds(input.applicationId);
    const amount = this.parseAmount(input.amount);

    switch (input.method) {
      case 'web_button':
        return this.pollWebButton(creds, input.invoiceNumber, amount, input.methodData);
      case 'card_ccr':
        // No Sitef status endpoint for CCR — payment resolves via submitOtp or redirect
        return { status: 'pending', gatewayReference: null, rawResponse: {} };
      default:
        return this.pollC2p(creds, input.invoiceNumber, amount, input.methodData);
    }
  }

  // -- C2P ------------------------------------------------------------------

  private async c2pRequestOtp(
    creds: SitefCredentials,
    invoiceNumber: string,
    amount: number,
    md: MethodData,
  ): Promise<CreatePaymentResult> {
    this.requireFields(md, ['destinationId', 'destinationMobileNumber', 'destinationBank']);

    const { request, response } = await this.client.post('/s4/sitefAuth/setDebitInmediatoSitef', creds, {
      destinationid: md.destinationId,
      destinationmobilenumber: this.toInternationalPhone(md.destinationMobileNumber),
      destinationbank: this.toBankCode(md.destinationBank),
      issuingbank: creds.acquirerBank,
      invoicenumber: invoiceNumber,
      amount,
    });

    const trx = response.data?.transaction_c2p_response;
    return this.mapC2pResult(trx, request, response);
  }

  private async c2pExecuteWithOtp(
    creds: SitefCredentials,
    invoiceNumber: string,
    amount: number,
    otp: string,
    md: MethodData,
  ): Promise<CreatePaymentResult> {
    this.requireFields(md, ['destinationId', 'destinationMobileNumber', 'destinationBank']);

    const { request, response } = await this.client.post('/s4/sitefAuth/setDebitInmediatoSitef', creds, {
      destinationid: md.destinationId,
      destinationmobilenumber: this.toInternationalPhone(md.destinationMobileNumber),
      destinationbank: this.toBankCode(md.destinationBank),
      issuingbank: creds.acquirerBank,
      invoicenumber: invoiceNumber,
      amount,
      otp,
    });

    const trx = response.data?.transaction_c2p_response;
    return this.mapC2pResult(trx, request, response);
  }

  private mapC2pResult(
    trx: SitefTransactionC2pResponse | undefined,
    request: Record<string, unknown>,
    response: Record<string, unknown>,
  ): CreatePaymentResult {
    if (!trx) {
      // Sitef respondió 200 pero sin el shape esperado — extraer cualquier info útil del body.
      const r = response as { code?: unknown; status?: unknown; message?: unknown; data?: unknown; error?: unknown };
      const fragments = [
        typeof r.code !== 'undefined' && `code=${JSON.stringify(r.code)}`,
        typeof r.status !== 'undefined' && `status=${JSON.stringify(r.status)}`,
        typeof r.message !== 'undefined' && `message=${JSON.stringify(r.message)}`,
        typeof r.error !== 'undefined' && `error=${JSON.stringify(r.error)}`,
      ].filter(Boolean);
      const summary = fragments.length > 0 ? fragments.join(' ') : JSON.stringify(response).slice(0, 500);

      this.logger.error(
        `Sitef devolvió respuesta inesperada (sin transaction_c2p_response). Body: ${JSON.stringify(response).slice(0, 2000)}`,
      );

      return {
        status: 'failed',
        gatewayReference: null,
        failureCode: 'NO_RESPONSE',
        failureMessage: `Sitef no devolvió transaction_c2p_response. ${summary}`,
        rawRequest: request,
        rawResponse: response,
      };
    }

    const statusText = (trx.trx_status ?? '').toLowerCase();
    if (statusText === 'approved') {
      return {
        status: 'succeeded',
        gatewayReference: trx.payment_reference?.toString() ?? null,
        rawRequest: request,
        rawResponse: response,
      };
    }
    if (statusText.includes('otp')) {
      return {
        status: 'requires_otp',
        gatewayReference: trx.payment_reference?.toString() ?? null,
        rawRequest: request,
        rawResponse: response,
      };
    }
    return {
      status: 'failed',
      gatewayReference: trx.payment_reference?.toString() ?? null,
      failureCode: trx.trx_internal_status,
      failureMessage: trx.trx_status,
      rawRequest: request,
      rawResponse: response,
    };
  }

  // -- Transfer -------------------------------------------------------------

  private async transfer(
    creds: SitefCredentials,
    invoiceNumber: string,
    amount: number,
    md: MethodData,
  ): Promise<CreatePaymentResult> {
    // getTrfSitef verifica una transferencia bancaria ya realizada por el cliente.
    // El cliente proporciona la referencia que le devolvió su banco al transferir.
    this.requireFields(md, ['paymentReference', 'originDni', 'originBank', 'trxDate']);

    const { request, response } = await this.client.post('/s4/sitefAuth/getTrfSitef', creds, {
      amount,
      paymentreference: md.paymentReference,
      origendni: md.originDni,
      origenbank: this.toBankCode(md.originBank),
      receivingbank: creds.acquirerBank,
      trxdate: md.trxDate,
    });

    return this.mapTransactionListResult(response, request, response as unknown as Record<string, unknown>);
  }

  // -- Pago Móvil -----------------------------------------------------------

  private async pagoMovil(
    creds: SitefCredentials,
    invoiceNumber: string,
    amount: number,
    md: MethodData,
  ): Promise<CreatePaymentResult> {
    // getBusquedaSitef verifica un pago móvil (P2C) ya realizado por el cliente.
    // El cliente proporciona la referencia que le devolvió su banco al pagar.
    this.requireFields(md, ['paymentReference', 'debitPhone', 'originBank', 'trxDate']);

    const { request, response } = await this.client.post('/s4/sitefAuth/getBusquedaSitef', creds, {
      amount,
      paymentreference: md.paymentReference,
      debitphone: this.toInternationalPhone(md.debitPhone),
      origenbank: this.toBankCode(md.originBank),
      invoicenumber: invoiceNumber,
      trxdate: md.trxDate,
      receivingbank: creds.acquirerBank,
    });

    return this.mapTransactionListResult(response, request, response as unknown as Record<string, unknown>);
  }

  // -- Card CCR (Credicard) -------------------------------------------------

  private async cardCcrCreate(
    creds: SitefCredentials,
    amount: number,
    md: MethodData,
  ): Promise<CreatePaymentResult> {
    this.requireFields(md, ['cardNumber', 'tipoDocumento', 'documentoCliente', 'cvc', 'monthExp', 'yearExp', 'cardHolderName']);

    const { request, response } = await this.client.postCamel('/s4/sitefAuth/setCCRSitefApi', creds, {
      amount,
      cardNumber: md.cardNumber,
      tipoDocumento: md.tipoDocumento,
      documentoCliente: md.documentoCliente,
      cvc: md.cvc,
      monthExp: md.monthExp,
      yearExp: md.yearExp,
      cardHolderName: md.cardHolderName,
    });

    const ccrResp = response as unknown as SitefCcrCreateResponse;
    const orderId = ccrResp.data?.id;
    const rawResponse = response as unknown as Record<string, unknown>;

    if (!orderId) {
      this.logger.error(`Sitef CCR setCCRSitefApi sin orderId. status=${ccrResp.status} body=${JSON.stringify(response).slice(0, 500)}`);
      return {
        status: 'failed',
        gatewayReference: null,
        failureCode: 'CCR_NO_ORDER',
        failureMessage: `Sitef CCR no devolvió orderId. status=${ccrResp.status}`,
        rawRequest: request,
        rawResponse,
      };
    }

    const ccrStatus = (ccrResp.status ?? '').toUpperCase();

    // READY_TO_PAY: el cliente paga escaneando QR o accediendo a paymentUrl en su banco.
    if (ccrStatus === 'READY_TO_PAY') {
      return {
        status: 'requires_action',
        gatewayReference: orderId,
        redirectUrl: ccrResp.data?.paymentUrl,
        rawRequest: request,
        rawResponse,
      };
    }

    // OTP_REQUIRED: el banco envía OTP al cliente por SMS — submitOtp lo finaliza.
    return {
      status: 'requires_otp',
      gatewayReference: orderId,
      rawRequest: request,
      rawResponse,
    };
  }

  private async cardCcrFinalize(
    creds: SitefCredentials,
    amount: number,
    otp: string,
    md: MethodData,
  ): Promise<CreatePaymentResult> {
    this.requireFields(md, ['cardNumber', 'tipoDocumento', 'documentoCliente', 'cvc', 'monthExp', 'yearExp', 'cardHolderName']);

    const orderId = md.gatewayReference ?? md.orderId;
    if (!orderId) throw new BadRequestException('CCR: orderId requerido para finalizar pago (gatewayReference vacío).');

    const { request, response } = await this.client.postCamel('/s4/sitefAuth/finalizarCCRSitef', creds, {
      orderId,
      amount,
      cardNumber: md.cardNumber,
      tipoDocumento: md.tipoDocumento,
      documentoCliente: md.documentoCliente,
      cardHolderName: md.cardHolderName,
      cvc: md.cvc,
      monthExp: md.monthExp,
      yearExp: md.yearExp,
      pin: md.pin ?? '',
      accountType: md.accountType ?? '',
      otp,
    });

    const ccrResp = response as unknown as SitefCcrFinalizeResponse;
    const rawResponse = response as unknown as Record<string, unknown>;
    const resultMsg = (ccrResp.data?.data?.receipt?.result?.message ?? '').toUpperCase();
    const paidStatus = ccrResp.data?.data?.status;
    const referenceId = ccrResp.data?.data?.referenceId ?? (orderId as string);

    if (resultMsg === 'APROBADO' || paidStatus === 'paid') {
      return {
        status: 'succeeded',
        gatewayReference: referenceId,
        rawRequest: request,
        rawResponse,
      };
    }

    return {
      status: 'failed',
      gatewayReference: orderId as string,
      failureCode: 'CCR_REJECTED',
      failureMessage: ccrResp.data?.data?.receipt?.result?.message ?? `Sitef CCR no aprobó el pago. status=${ccrResp.status}`,
      rawRequest: request,
      rawResponse,
    };
  }

  // -- Transaction list helper ----------------------------------------------

  private mapTransactionListResult(
    r: SitefOperationResponse,
    request: Record<string, unknown>,
    rawResponse: Record<string, unknown>,
  ): CreatePaymentResult {
    // Sitef devuelve error_list cuando un campo es inválido (ej. referencia mal formada).
    // Hay que exponerlo en vez de enmascararlo como un genérico NOT_FOUND.
    const sitefError = r.data?.error_list?.[0];
    if (sitefError) {
      return {
        status: 'failed',
        gatewayReference: null,
        failureCode: `SITEF_${sitefError.error_code ?? 'ERROR'}`,
        failureMessage: sitefError.description ?? 'Sitef rechazó la verificación.',
        rawRequest: request,
        rawResponse,
      };
    }

    const tx = r.data?.transaction_list?.[0];
    if (!tx) {
      return {
        status: 'failed',
        gatewayReference: null,
        failureCode: 'NOT_FOUND',
        failureMessage: 'Transacción no encontrada en Sitef. Verifique el número de referencia y los datos ingresados.',
        rawRequest: request,
        rawResponse,
      };
    }
    return {
      status: 'succeeded',
      gatewayReference: tx.payment_reference?.toString() ?? null,
      rawRequest: request,
      rawResponse,
    };
  }

  // -- Web Button ----------------------------------------------------------

  private async webButton(
    creds: SitefCredentials,
    invoiceNumber: string,
    amount: number,
    md: MethodData,
  ): Promise<CreatePaymentResult> {
    this.requireFields(md, ['clientName', 'returnUrl']);

    const { request, response } = await this.client.post('/s4/sitefAuth/getAuthWeb', creds, {
      clientname: md.clientName,
      url: md.returnUrl,
      receivingbank: this.toBankCode(md.receivingBank ?? creds.acquirerBank),
      amount,
      invoicenumber: invoiceNumber,
    });

    const trx = response.data?.transaction_c2p_response;
    // En getAuthWeb la URL viene en payment_method.
    const redirectUrl =
      typeof trx?.payment_method === 'string' && trx.payment_method.startsWith('http') ? trx.payment_method : undefined;

    if (redirectUrl) {
      return {
        status: 'requires_action',
        gatewayReference: invoiceNumber,
        redirectUrl,
        rawRequest: request,
        rawResponse: response,
      };
    }

    if (!trx) {
      // Sitef respondió 200 pero sin transaction_c2p_response — extraer info útil del body
      // para que failureCode/Message no queden null (mismo patrón que mapC2pResult).
      const r = response as { code?: unknown; status?: unknown; message?: unknown; error?: unknown };
      const fragments = [
        typeof r.code !== 'undefined' && `code=${JSON.stringify(r.code)}`,
        typeof r.status !== 'undefined' && `status=${JSON.stringify(r.status)}`,
        typeof r.message !== 'undefined' && `message=${JSON.stringify(r.message)}`,
        typeof r.error !== 'undefined' && `error=${JSON.stringify(r.error)}`,
      ].filter(Boolean);
      const summary = fragments.length > 0 ? fragments.join(' ') : JSON.stringify(response).slice(0, 500);

      this.logger.error(
        `Sitef getAuthWeb devolvió respuesta inesperada (sin transaction_c2p_response ni redirectUrl). Body: ${JSON.stringify(response).slice(0, 2000)}`,
      );

      return {
        status: 'failed',
        gatewayReference: invoiceNumber,
        failureCode: 'NO_RESPONSE',
        failureMessage: `Sitef getAuthWeb no devolvió URL de pago. ${summary}`,
        rawRequest: request,
        rawResponse: response,
      };
    }

    return {
      status: 'failed',
      gatewayReference: invoiceNumber,
      failureCode: trx.trx_internal_status ?? 'NO_REDIRECT_URL',
      failureMessage: trx.trx_status ?? 'Sitef devolvió transaction_c2p_response sin payment_method (URL).',
      rawRequest: request,
      rawResponse: response,
    };
  }

  // -- Polling --------------------------------------------------------------

  private async pollC2p(
    creds: SitefCredentials,
    invoiceNumber: string,
    amount: number,
    md: MethodData,
  ): Promise<GatewayStatusResult> {
    // getBusquedaSitef necesita: amount, paymentreference, debitphone, origenbank, invoicenumber, trxdate, receivingbank.
    this.requireFields(md, ['paymentReference', 'debitPhone', 'originBank', 'trxDate']);

    const { response } = await this.client.post('/s4/sitefAuth/getBusquedaSitef', creds, {
      amount,
      paymentreference: md.paymentReference,
      debitphone: md.debitPhone,
      origenbank: this.toBankCode(md.originBank),
      invoicenumber: invoiceNumber,
      trxdate: md.trxDate,
      receivingbank: creds.acquirerBank,
    });

    const tx = response.data?.transaction_list?.[0];
    if (!tx) {
      return { status: 'pending', gatewayReference: null, rawResponse: response };
    }

    return {
      status: 'succeeded',
      gatewayReference: tx.payment_reference?.toString() ?? null,
      authorizationCode: tx.authorization_code,
      rawResponse: response,
    };
  }

  private async pollWebButton(
    creds: SitefCredentials,
    invoiceNumber: string,
    amount: number,
    md: MethodData,
  ): Promise<GatewayStatusResult> {
    this.requireFields(md, ['trxDate']);

    const { response } = await this.client.post('/s4/sitefAuth/getBusquedaDebInmediatoSitef', creds, {
      receivingbank: creds.acquirerBank,
      amount,
      invoicenumber: invoiceNumber,
      trxdate: md.trxDate,
    });

    const tx = response.data?.transaction_list?.[0];
    if (!tx) {
      return { status: 'pending', gatewayReference: null, rawResponse: response };
    }

    return {
      status: 'succeeded',
      gatewayReference: tx.payment_reference?.toString() ?? null,
      authorizationCode: tx.authorization_code,
      rawResponse: response,
    };
  }

  // -- Helpers --------------------------------------------------------------

  private async resolveCreds(applicationId: string): Promise<SitefCredentials> {
    const terminal = await this.terminals.resolveForApplication(applicationId);
    return {
      username: terminal.sitefUsername,
      password: terminal.sitefPassword,
      idBranch: terminal.sitefIdBranch,
      codeStall: terminal.sitefCodeStall,
      acquirerBank: terminal.acquirerBank,
    };
  }

  /**
   * Sitef recibe `amount` como Number con 2 decimales. Construimos un Money en VES
   * (Sitef cobra en VES) que valida scale/precisión, y convertimos a number
   * para serializar al payload. `Money.toNumber()` es la única conversión
   * IEEE 754 en todo el path — el resto del cómputo se mantiene en Decimal.
   */
  private parseAmount(amount: string): number {
    try {
      const m = Money.parse(amount, 'VES');
      if (!m.isPositive()) {
        throw new BadRequestException(`Monto inválido (no positivo): ${amount}`);
      }
      return m.toNumber();
    } catch (err) {
      if (err instanceof MoneyError) {
        throw new BadRequestException(`Monto inválido: ${amount} — ${err.message}`);
      }
      throw err;
    }
  }

  private toBankCode(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const trimmed = value.replace(/^0+/, '');
      const n = parseInt(trimmed, 10);
      if (Number.isFinite(n)) return n;
    }
    throw new BadRequestException(`Código de banco inválido: ${value}`);
  }

  /**
   * Normaliza un número de teléfono venezolano al formato que exige Sitef: 584XXXXXXXXXX (12 dígitos).
   * Acepta: 04XXXXXXXXX (11 dig), 4XXXXXXXXX (10 dig), 584XXXXXXXXXX (ya correcto).
   */
  private toInternationalPhone(value: unknown): string {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new BadRequestException(`Teléfono inválido: ${value}`);
    }
    const digits = String(value).replace(/\D/g, '');

    // Ya en formato internacional
    if (digits.startsWith('58') && digits.length === 12) return digits;
    // Formato venezolano con 0: 04XX... (11 dígitos)
    if (digits.startsWith('0') && digits.length === 11) return '58' + digits.slice(1);
    // Sin prefijo: 4XX... (10 dígitos)
    if (digits.length === 10) return '58' + digits;

    throw new BadRequestException(
      `Teléfono inválido: "${value}". Usa formato 04XXXXXXXXX (ej: 04120000000) o 584XXXXXXXXXX.`,
    );
  }

  private requireFields(md: MethodData, fields: string[]): void {
    const missing = fields.filter((f) => md[f] === undefined || md[f] === null || md[f] === '');
    if (missing.length > 0) {
      throw new BadRequestException(`Faltan campos: ${missing.join(', ')}`);
    }
  }
}
