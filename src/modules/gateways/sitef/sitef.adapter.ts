import { Logger, Injectable, BadRequestException } from '@nestjs/common';

import { SitefClient } from './sitef.client';
import { Money, MoneyError } from '@/common/money/money';
import {
  SitefCredentials,
  SitefOperationResponse,
  SitefTransactionC2pResponse,
  SitefTransactionKeyInfoResponse,
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
      case 'card':
        return this.mercantilCard(creds, input.invoiceNumber, amount, input.methodData);
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
    if (input.method === 'card') {
      return this.mercantilDebitFinalize(creds, input.invoiceNumber, amount, input.otp, input.methodData);
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
      destinationid: this.toIdentityDocument(md.destinationId),
      destinationmobilenumber: this.toInternationalPhone(md.destinationMobileNumber),
      // issuingbank = banco EMISOR: el banco del cliente que teclea en el formulario, el que
      // emite/autoriza el débito y le manda la OTP. destinationbank = banco RECEPTOR del
      // comercio (adquiriente, Mercantil 105). Antes iban al revés y Sitef rechazaba con
      // "Banco emisor no autorizado" cuando el cliente no era del banco adquiriente.
      destinationbank: creds.acquirerBank,
      issuingbank: this.toBankCode(md.destinationBank),
      invoicenumber: invoiceNumber,
      amount,
    });

    const trx = response.data?.transaction_c2p_response;
    return this.mapC2pResult(trx, request, response, 'request');
  }

  private async c2pExecuteWithOtp(
    creds: SitefCredentials,
    invoiceNumber: string,
    amount: number,
    otp: string,
    md: MethodData,
  ): Promise<CreatePaymentResult> {
    this.requireFields(md, ['destinationId', 'destinationMobileNumber', 'destinationBank']);

    // Variante Mercantil: el paso 1 devolvió un authenticationToken de sesión (guardado en
    // method_data vía methodDataPatch). Se reenvía junto con la OTP — en camelCase: a diferencia
    // del resto de la API (todo minúsculas), el motor Mercantil exige ese casing; con
    // "authenticationtoken" responde 4000 "Falta el campo 'authenticationToken'".
    // Terminales Banesco no traen estos campos y su payload no cambia.
    const mercantilSession: Record<string, unknown> = {};
    if (typeof md.mercantilAuthToken === 'string' && md.mercantilAuthToken.length > 0) {
      mercantilSession.authenticationToken = md.mercantilAuthToken;
      if (md.mercantilReferenceNumber != null) {
        mercantilSession.referenceNumber = md.mercantilReferenceNumber;
      }
    }

    const { request, response } = await this.client.post('/s4/sitefAuth/setDebitInmediatoSitef', creds, {
      destinationid: this.toIdentityDocument(md.destinationId),
      destinationmobilenumber: this.toInternationalPhone(md.destinationMobileNumber),
      // issuingbank = banco EMISOR: el banco del cliente que teclea en el formulario, el que
      // emite/autoriza el débito y le manda la OTP. destinationbank = banco RECEPTOR del
      // comercio (adquiriente, Mercantil 105). Antes iban al revés y Sitef rechazaba con
      // "Banco emisor no autorizado" cuando el cliente no era del banco adquiriente.
      destinationbank: creds.acquirerBank,
      issuingbank: this.toBankCode(md.destinationBank),
      invoicenumber: invoiceNumber,
      amount,
      otp,
      ...mercantilSession,
    });

    const trx = response.data?.transaction_c2p_response;
    return this.mapC2pResult(trx, request, response, 'execute');
  }

  private mapC2pResult(
    trx: SitefTransactionC2pResponse | undefined,
    request: Record<string, unknown>,
    response: SitefOperationResponse,
    stage: 'request' | 'execute',
  ): CreatePaymentResult {
    // Un `messages[]` raíz (ej. "Transaccion duplicada") invalida la respuesta completa,
    // aunque venga con transaction_c2p_response en estado approved.
    const rejection = this.sitefRejection(response);
    if (rejection) {
      return {
        status: 'failed',
        gatewayReference: trx?.payment_reference?.toString() ?? null,
        failureCode: rejection.code,
        failureMessage: rejection.message,
        rawRequest: request,
        rawResponse: response as unknown as Record<string, unknown>,
      };
    }

    // Dialecto Mercantil del débito inmediato (ver SitefTransactionKeyInfoResponse):
    // respuesta camelCase con authenticationToken en vez de transaction_c2p_response.
    const keyInfo = response.data?.transactionKeyInfoResponse;
    if (keyInfo) {
      return this.mapMercantilKeyInfo(keyInfo, stage, request, response);
    }

    // Paso 2 del dialecto Mercantil: `immediateDebitResponse` ES la confirmación del débito
    // (no trae trx_status; los rechazos llegan por error_list/messages, ya cortados arriba).
    const debit = response.data?.immediateDebitResponse;
    if (debit) {
      const reference = debit.immediateDebitReference ?? debit.referenceNumber;
      if (reference != null) {
        return {
          status: 'succeeded',
          gatewayReference: reference.toString(),
          rawRequest: request,
          rawResponse: response as unknown as Record<string, unknown>,
        };
      }
      // Bloque de débito sin ninguna referencia: ambiguo → fail-closed con detalle. El dinero
      // puede haberse movido — el admin puede otorgar manualmente tras verificar con el banco.
      this.logger.error(
        `Débito inmediato Mercantil: immediateDebitResponse sin referencia. Body: ${JSON.stringify(response).slice(0, 1000)}`,
      );
      return {
        status: 'failed',
        gatewayReference: null,
        failureCode: 'MERCANTIL_DEBIT_NO_REFERENCE',
        failureMessage:
          'El banco respondió el débito sin número de referencia. Verifica en tu banco si el cobro se realizó antes de reintentar.',
        rawRequest: request,
        rawResponse: response as unknown as Record<string, unknown>,
      };
    }

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

  /**
   * Mapea la respuesta del motor C2P de Mercantil (dialecto NO documentado — ver
   * SitefTransactionKeyInfoResponse). Contrato observado en producción:
   *
   * Paso 1 (solicitud): trxStatus "Solicitud realizada exitosamente" + authenticationToken +
   * referenceNumber + un invoiceNumber propio de Sitef (FAC-...). La OTP viaja al cliente →
   * `requires_otp`, y el token/referencia se guardan en method_data para reenviarse en el paso 2.
   *
   * Paso 2 (ejecución con OTP): el contrato de respuesta exitosa no está documentado. Si Sitef
   * devuelve transaction_c2p_response approved, lo captura el mapeo normal. Si responde OTRA
   * solicitud de clave, NO es una confirmación: fail-closed con el detalle para soporte —
   * jamás acreditar un cobro sobre una respuesta ambigua.
   */
  private mapMercantilKeyInfo(
    keyInfo: SitefTransactionKeyInfoResponse,
    stage: 'request' | 'execute',
    request: Record<string, unknown>,
    response: SitefOperationResponse,
  ): CreatePaymentResult {
    const rawResponse = response as unknown as Record<string, unknown>;
    const trxStatus = keyInfo.trxStatus ?? '';
    const requested = trxStatus.toLowerCase().includes('exitos');

    if (stage === 'request' && requested) {
      return {
        status: 'requires_otp',
        gatewayReference: keyInfo.referenceNumber?.toString() ?? null,
        methodDataPatch: {
          mercantilAuthToken: keyInfo.authenticationToken,
          mercantilReferenceNumber: keyInfo.referenceNumber?.toString(),
          sitefInvoiceNumber: keyInfo.invoiceNumber?.number,
        },
        rawRequest: request,
        rawResponse,
      };
    }

    if (stage === 'execute') {
      this.logger.error(
        `Débito inmediato Mercantil: la ejecución con OTP devolvió transactionKeyInfoResponse ` +
          `(trxStatus="${trxStatus}") en vez de una confirmación. Escalar a Sitef con ` +
          `referenceNumber=${keyInfo.referenceNumber} y el invoice Sitef=${keyInfo.invoiceNumber?.number}.`,
      );
      return {
        status: 'failed',
        gatewayReference: keyInfo.referenceNumber?.toString() ?? null,
        failureCode: 'MERCANTIL_C2P_NO_CONFIRMATION',
        failureMessage:
          'El banco no confirmó el débito (respondió una nueva solicitud de clave). ' +
          'No se realizó ningún cobro — intenta de nuevo o contacta a soporte.',
        rawRequest: request,
        rawResponse,
      };
    }

    return {
      status: 'failed',
      gatewayReference: keyInfo.referenceNumber?.toString() ?? null,
      failureCode: 'MERCANTIL_C2P_REQUEST_FAILED',
      failureMessage: trxStatus || 'El banco no pudo iniciar la solicitud de clave.',
      rawRequest: request,
      rawResponse,
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
      paymentreference: this.toPaymentReference(md.paymentReference),
      origendni: this.toIdentityDocument(md.originDni),
      origenbank: this.toBankCode(md.originBank),
      receivingbank: creds.acquirerBank,
      trxdate: this.toSitefDate(md.trxDate),
    });

    // getTrfSitef no recibe invoicenumber, así que no hay cruce de factura que validar aquí:
    // la reutilización de una transferencia la ataja el guard de referencia en PaymentsService.
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
      paymentreference: this.toPaymentReference(md.paymentReference),
      debitphone: this.toInternationalPhone(md.debitPhone),
      origenbank: this.toBankCode(md.originBank),
      invoicenumber: invoiceNumber,
      trxdate: this.toSitefDate(md.trxDate),
      receivingbank: creds.acquirerBank,
    });

    return this.mapTransactionListResult(
      response,
      request,
      response as unknown as Record<string, unknown>,
      invoiceNumber,
    );
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

  // -- Card (Botón Mercantil) -----------------------------------------------

  /**
   * Botón de Pago Mercantil. El crédito (TDC) es un solo paso (`setPay`). El débito (TDD)
   * son dos: `getAuth` dispara el segundo factor (OTP) y devuelve `requires_otp`; el débito
   * se finaliza en `submitOtp` → `mercantilDebitFinalize` (`setPay` con `twofactor_auth`).
   *
   * PAN/CVV nunca se persisten: para el débito, el navegador retiene la tarjeta y la reenvía
   * en el paso del OTP. `cardNumber`/`cvv` viajan como string (un número JSON de 16+ dígitos
   * pierde precisión y un CVV "043" perdería el cero).
   */
  private async mercantilCard(
    creds: SitefCredentials,
    invoiceNumber: string,
    amount: number,
    md: MethodData,
  ): Promise<CreatePaymentResult> {
    this.requireFields(md, ['cardNumber', 'customerId']);

    if (this.isDebitCard(md)) {
      // Paso 1 (TDD): autenticación → dispara el OTP.
      const { request, response } = await this.client.postCamel('/s4/sitefAuth/getAuth', creds, {
        customerId: this.toIdentityDocument(md.customerId),
        cardNumber: this.toCardNumber(md.cardNumber),
        paymentMethod: 'TDD',
      });
      return this.mapMercantilAuthResult(response, request, response as unknown as Record<string, unknown>);
    }

    // TDC: un solo paso.
    this.requireFields(md, ['expirationDate', 'cvv']);
    const { request, response } = await this.client.postCamel('/s4/sitefAuth/setPay', creds, {
      cardNumber: this.toCardNumber(md.cardNumber),
      paymentMethod: 'TDC',
      customerId: this.toIdentityDocument(md.customerId),
      expirationDate: this.toCardExpiration(md.expirationDate),
      cvv: this.toCvv(md.cvv),
      invoiceNumber: this.toMercantilInvoiceNumber(invoiceNumber),
      currency: 'VES',
      amount,
    });
    return this.mapMercantilPayResult(response, request, response as unknown as Record<string, unknown>);
  }

  /** Paso 2 (TDD): `setPay` con el OTP como `twofactor_auth`. La tarjeta la reenvía el cliente. */
  private async mercantilDebitFinalize(
    creds: SitefCredentials,
    invoiceNumber: string,
    amount: number,
    otp: string,
    md: MethodData,
  ): Promise<CreatePaymentResult> {
    this.requireFields(md, ['cardNumber', 'customerId', 'expirationDate', 'cvv', 'accountType']);
    const { request, response } = await this.client.postCamel('/s4/sitefAuth/setPay', creds, {
      cardNumber: this.toCardNumber(md.cardNumber),
      paymentMethod: 'TDD',
      accountType: this.toAccountType(md.accountType),
      customerId: this.toIdentityDocument(md.customerId),
      expirationDate: this.toCardExpiration(md.expirationDate),
      cvv: this.toCvv(md.cvv),
      invoiceNumber: this.toMercantilInvoiceNumber(invoiceNumber),
      currency: 'VES',
      amount,
      twofactor_auth: String(otp ?? '').replace(/\D/g, ''),
    });
    return this.mapMercantilPayResult(response, request, response as unknown as Record<string, unknown>);
  }

  /** getAuth (TDD): autenticación aprobada → `requires_otp`. */
  private mapMercantilAuthResult(
    r: SitefOperationResponse,
    request: Record<string, unknown>,
    rawResponse: Record<string, unknown>,
  ): CreatePaymentResult {
    const sitefError = r.data?.error_list?.[0];
    if (sitefError) return this.mercantilError(sitefError, request, rawResponse);

    const rejection = this.sitefRejection(r);
    if (rejection) {
      return {
        status: 'failed',
        gatewayReference: null,
        failureCode: rejection.code,
        failureMessage: rejection.message,
        rawRequest: request,
        rawResponse,
      };
    }

    const auth = r.data?.authentication_info;
    if (auth && (auth.trx_status ?? '').toLowerCase() === 'approved') {
      return { status: 'requires_otp', gatewayReference: null, rawRequest: request, rawResponse };
    }
    return {
      status: 'failed',
      gatewayReference: null,
      failureCode: 'MERCANTIL_AUTH_FAILED',
      failureMessage: auth?.trx_status ?? 'Mercantil no pudo iniciar la autenticación de la tarjeta.',
      rawRequest: request,
      rawResponse,
    };
  }

  /** setPay (TDC/TDD): `trx_status === 'approved'` → succeeded. */
  private mapMercantilPayResult(
    r: SitefOperationResponse,
    request: Record<string, unknown>,
    rawResponse: Record<string, unknown>,
  ): CreatePaymentResult {
    const sitefError = r.data?.error_list?.[0];
    if (sitefError) return this.mercantilError(sitefError, request, rawResponse);

    const rejection = this.sitefRejection(r);
    if (rejection) {
      return {
        status: 'failed',
        gatewayReference: null,
        failureCode: rejection.code,
        failureMessage: rejection.message,
        rawRequest: request,
        rawResponse,
      };
    }

    const tx = r.data?.transaction_response;
    if (tx && (tx.trx_status ?? '').toLowerCase() === 'approved') {
      return {
        status: 'succeeded',
        gatewayReference: tx.payment_reference?.toString() ?? null,
        rawRequest: request,
        rawResponse,
      };
    }
    return {
      status: 'failed',
      gatewayReference: tx?.payment_reference?.toString() ?? null,
      failureCode: tx?.trx_internal_status ? `MERCANTIL_${tx.trx_internal_status}` : 'MERCANTIL_REJECTED',
      failureMessage: tx?.trx_status ?? 'Mercantil rechazó el pago con tarjeta.',
      rawRequest: request,
      rawResponse,
    };
  }

  private mercantilError(
    err: { error_code?: string; description?: string },
    request: Record<string, unknown>,
    rawResponse: Record<string, unknown>,
  ): CreatePaymentResult {
    return {
      status: 'failed',
      gatewayReference: null,
      failureCode: `MERCANTIL_${err.error_code ?? 'ERROR'}`,
      failureMessage: err.description ?? 'Mercantil rechazó la transacción.',
      rawRequest: request,
      rawResponse,
    };
  }

  // -- Transaction list helper ----------------------------------------------

  private mapTransactionListResult(
    r: SitefOperationResponse,
    request: Record<string, unknown>,
    rawResponse: Record<string, unknown>,
    expectedInvoiceNumber?: string,
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

    // `messages` a nivel raíz es un RECHAZO aunque venga acompañado de transaction_list:
    // el caso real es "Transaccion duplicada" — Sitef devuelve la transacción original,
    // ya consumida por otra factura. Sin este corte se aprobaba el cobro por segunda vez.
    // Fail-closed a propósito: ante un aviso que no sabemos interpretar, no se otorga nada.
    const rejection = this.sitefRejection(r);
    if (rejection) {
      return {
        status: 'failed',
        gatewayReference: null,
        failureCode: rejection.code,
        failureMessage: rejection.message,
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

    // Segunda defensa: si Sitef ligó la transacción a OTRA factura, la referencia ya se usó
    // aunque no haya mandado `messages`. Solo aplica cuando enviamos invoicenumber en el
    // request (pago móvil sí, transferencia no) y Sitef lo devuelve.
    const boundInvoice = (tx.invoice_number ?? '').trim();
    if (expectedInvoiceNumber && boundInvoice && boundInvoice !== expectedInvoiceNumber) {
      return {
        status: 'failed',
        gatewayReference: null,
        failureCode: 'REFERENCE_ALREADY_USED',
        failureMessage:
          `Esta referencia ya fue usada para pagar la factura ${boundInvoice}. ` +
          'Cada pago solo puede acreditarse una vez. Verifique el número de referencia.',
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

  /**
   * Traduce el `messages[]` raíz de Sitef a un rechazo. Los textos vienen redactados para
   * el cliente final ("Transacción ya procesada anteriormente. Referencia: 744753"), así
   * que se propagan tal cual a `failureMessage` y la landing los pinta en pantalla.
   */
  private sitefRejection(r: SitefOperationResponse): { code: string; message: string } | null {
    const messages = (r.messages ?? []).filter((m) => m?.message || m?.field);
    if (messages.length === 0) return null;

    // Al cliente solo se le muestra `message` (ya viene redactado para él). `field` es el
    // identificador técnico de Sitef ("issuingBank", "Transaccion duplicada"): sirve para
    // clasificar el fallo y queda en el raw_response, pero no se pinta en pantalla.
    const text = messages
      .map((m) => m.message?.trim())
      .filter((m): m is string => !!m)
      .join(' ');
    const isDuplicate = messages.some((m) => `${m.field ?? ''} ${m.message ?? ''}`.toLowerCase().includes('duplicad'));

    this.logger.warn(`Sitef rechazó con messages[]: ${JSON.stringify(messages)}`);
    return {
      code: isDuplicate ? 'REFERENCE_ALREADY_USED' : 'SITEF_MESSAGE',
      message: text || 'Sitef rechazó la operación.',
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

    const rejection = this.sitefRejection(response);
    if (rejection) {
      return {
        status: 'failed',
        gatewayReference: invoiceNumber,
        failureCode: rejection.code,
        failureMessage: rejection.message,
        rawRequest: request,
        rawResponse: response as unknown as Record<string, unknown>,
      };
    }

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

    // Las mismas normalizaciones que en `pagoMovil` (creación): Sitef debe recibir
    // EXACTAMENTE los mismos valores para cruzar la transacción, o el polling no la encuentra.
    const { response } = await this.client.post('/s4/sitefAuth/getBusquedaSitef', creds, {
      amount,
      paymentreference: this.toPaymentReference(md.paymentReference),
      debitphone: this.toInternationalPhone(md.debitPhone),
      origenbank: this.toBankCode(md.originBank),
      invoicenumber: invoiceNumber,
      trxdate: this.toSitefDate(md.trxDate),
      receivingbank: creds.acquirerBank,
    });

    return this.mapPollResult(response, invoiceNumber);
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
      trxdate: this.toSitefDate(md.trxDate),
    });

    return this.mapPollResult(response, invoiceNumber);
  }

  /**
   * Mismos cortes que `mapTransactionListResult` pero en clave de polling: "no encontrada"
   * es `pending` (aún puede aparecer), mientras que un rechazo explícito de Sitef o una
   * factura cruzada es `failed` definitivo — reintentar no lo va a arreglar y dejarlo en
   * pending haría que el worker terminara aprobando un pago ya consumido.
   */
  private mapPollResult(r: SitefOperationResponse, expectedInvoiceNumber: string): GatewayStatusResult {
    const rawResponse = r as unknown as Record<string, unknown>;

    const rejection = this.sitefRejection(r);
    if (rejection) {
      return {
        status: 'failed',
        gatewayReference: null,
        failureCode: rejection.code,
        failureMessage: rejection.message,
        rawResponse,
      };
    }

    const tx = r.data?.transaction_list?.[0];
    if (!tx) {
      return { status: 'pending', gatewayReference: null, rawResponse };
    }

    const boundInvoice = (tx.invoice_number ?? '').trim();
    if (boundInvoice && boundInvoice !== expectedInvoiceNumber) {
      return {
        status: 'failed',
        gatewayReference: null,
        failureCode: 'REFERENCE_ALREADY_USED',
        failureMessage:
          `Esta referencia ya fue usada para pagar la factura ${boundInvoice}. ` +
          'Cada pago solo puede acreditarse una vez.',
        rawResponse,
      };
    }

    return {
      status: 'succeeded',
      gatewayReference: tx.payment_reference?.toString() ?? null,
      authorizationCode: tx.authorization_code,
      rawResponse,
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

  /**
   * Normaliza la referencia de pago al formato que matchea Sitef: hasta 8 dígitos.
   * Muchos bancos devuelven referencias de 10-12 dígitos, pero Sitef solo cruza por los
   * ÚLTIMOS 8 — si mandamos más, rechaza con "Error en el campo PaymentReference".
   * Quita separadores (espacios, guiones) y, si sobran dígitos, conserva los últimos 8.
   */
  private toPaymentReference(value: unknown): string {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new BadRequestException(`Referencia de pago inválida: ${value}`);
    }
    const digits = String(value).replace(/\D/g, '');
    if (digits.length === 0) {
      throw new BadRequestException(`Referencia de pago inválida: "${value}". Debe contener al menos un dígito.`);
    }
    return digits.length > 8 ? digits.slice(-8) : digits;
  }

  /**
   * Normaliza cédula/RIF al formato que exige Sitef: letra de tipo + dígitos (ej. "V30749551").
   * Acepta entradas con separadores ("V-30.749.551", "v 30749551"). Si viene solo el número,
   * asume "V" (cédula venezolana, el caso más común). Prefijos válidos: V/E/J/P/G.
   */
  private toIdentityDocument(value: unknown): string {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new BadRequestException(`Documento de identidad inválido: ${value}`);
    }
    const cleaned = String(value)
      .toUpperCase()
      .replace(/[^VEJPG0-9]/g, '');
    const withPrefix = /^[VEJPG]/.test(cleaned) ? cleaned : `V${cleaned}`;
    if (!/^[VEJPG]\d{5,12}$/.test(withPrefix)) {
      throw new BadRequestException(
        `Documento de identidad inválido: "${value}". Usa formato V12345678 (V/E/J/P/G + dígitos).`,
      );
    }
    return withPrefix;
  }

  /** Valida/normaliza la fecha de transacción al formato que exige Sitef (YYYY-MM-DD). */
  private toSitefDate(value: unknown): string {
    const s = String(value ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    throw new BadRequestException(`Fecha de transacción inválida: "${value}". Usa formato YYYY-MM-DD.`);
  }

  private isDebitCard(md: MethodData): boolean {
    const t = String(md.cardType ?? '').toLowerCase();
    return t === 'debit' || t === 'tdd' || t === 'debito' || t === 'débito';
  }

  /** Número de tarjeta → solo dígitos (13-19). Se envía como string para no perder precisión. */
  private toCardNumber(value: unknown): string {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) {
      throw new BadRequestException('Número de tarjeta inválido.');
    }
    return digits;
  }

  /** Vencimiento → "YYYY/MM" (lo que exige Mercantil). Acepta MM/YY, MM/YYYY, YYYY/MM y con "-". */
  private toCardExpiration(value: unknown): string {
    const m = String(value ?? '')
      .trim()
      .match(/^(\d{2}|\d{4})\s*[/-]\s*(\d{2}|\d{4})$/);
    if (!m) throw new BadRequestException('Fecha de vencimiento inválida. Usa formato YYYY/MM.');
    const [, a, b] = m;
    let year: string;
    let month: string;
    if (a.length === 4) {
      year = a;
      month = b;
    } else if (b.length === 4) {
      year = b;
      month = a;
    } else {
      // Ambos de 2 dígitos → se asume MM/YY.
      month = a;
      year = `20${b}`;
    }
    const mm = parseInt(month, 10);
    if (mm < 1 || mm > 12) throw new BadRequestException('Mes de vencimiento inválido.');
    return `${year}/${month.padStart(2, '0')}`;
  }

  /** CVV → string de 3-4 dígitos (string para conservar ceros a la izquierda, ej. "043"). */
  private toCvv(value: unknown): string {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length < 3 || digits.length > 4) throw new BadRequestException('CVV inválido.');
    return digits;
  }

  private toAccountType(value: unknown): string {
    const t = String(value ?? '').toUpperCase();
    if (t === 'CC' || t === 'CA') return t;
    throw new BadRequestException('Tipo de cuenta inválido. Usa CC (corriente) o CA (ahorro).');
  }

  /**
   * Mercantil limita `invoiceNumber` a 12 caracteres (error 0071). Nuestro correlativo
   * `CLI-YYYY-NNNNNN` (15 chars) se compacta a solo dígitos (año + secuencia, único),
   * capado a los últimos 12. Los demás métodos Sitef aceptan el número completo, así que
   * esto SOLO aplica al Botón Mercantil.
   */
  private toMercantilInvoiceNumber(invoiceNumber: string): string {
    const digits = String(invoiceNumber ?? '').replace(/\D/g, '');
    const compact = digits.length > 0 ? digits : String(invoiceNumber ?? '').replace(/[^a-zA-Z0-9]/g, '');
    return compact.length > 12 ? compact.slice(-12) : compact;
  }

  private requireFields(md: MethodData, fields: string[]): void {
    const missing = fields.filter((f) => md[f] === undefined || md[f] === null || md[f] === '');
    if (missing.length > 0) {
      throw new BadRequestException(`Faltan campos: ${missing.join(', ')}`);
    }
  }
}
