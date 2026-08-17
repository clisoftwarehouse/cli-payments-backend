import { SitefClient } from './sitef.client';
import { SitefAdapter } from './sitef.adapter';
import { MerchantTerminalsService } from '@/modules/merchant-terminals/merchant-terminals.service';

/**
 * Verifica la normalización de campos antes de enviarlos a Sitef. Mockeamos SitefClient
 * para capturar el payload (3er argumento de `post`) sin tocar red ni BD. Lo clave:
 * crear y poll deben mandar EXACTAMENTE los mismos valores normalizados, o Sitef no
 * cruza la transacción (regresión real: el poller mandaba el teléfono crudo).
 */
describe('SitefAdapter — normalización de campos Sitef', () => {
  let postMock: jest.Mock;
  let postCamelMock: jest.Mock;
  let adapter: SitefAdapter;

  // Respuesta que satisface tanto a mapTransactionListResult (transaction_list) como a
  // mapC2pResult (transaction_c2p_response) sin disparar logs de error.
  const okResponse = {
    data: {
      transaction_list: [{ payment_reference: 'REF123', authorization_code: 'AUTH1' }],
      transaction_c2p_response: { trx_status: 'approved', payment_reference: 'REF123' },
    },
  };

  const lastBody = (): Record<string, unknown> => postMock.mock.calls.at(-1)![2] as Record<string, unknown>;
  const lastCamelBody = (): Record<string, unknown> => postCamelMock.mock.calls.at(-1)![2] as Record<string, unknown>;
  const lastCamelPath = (): string => postCamelMock.mock.calls.at(-1)![0] as string;

  beforeEach(() => {
    postMock = jest.fn((_path: string, _creds: unknown, body: Record<string, unknown>) => ({
      request: body,
      response: okResponse,
    }));

    // Mercantil usa postCamel. Respuesta combinada: authentication_info (getAuth → requires_otp)
    // + transaction_response (setPay → succeeded); cada mapper mira solo el campo que le toca.
    postCamelMock = jest.fn((_path: string, _creds: unknown, body: Record<string, unknown>) => ({
      request: body,
      response: {
        data: {
          authentication_info: { trx_status: 'approved', twofactor_type: 'otp', twoFactorLenght: 8 },
          transaction_response: { trx_status: 'approved', payment_reference: 'MERC123' },
        },
      },
    }));

    const client = { post: postMock, postCamel: postCamelMock } as unknown as SitefClient;
    const terminals = {
      resolveForApplication: jest.fn(() => ({
        sitefUsername: 'cobeca',
        sitefPassword: 'pwd',
        sitefIdBranch: 117,
        sitefCodeStall: '017',
        acquirerBank: 134,
      })),
    } as unknown as MerchantTerminalsService;

    adapter = new SitefAdapter(client, terminals);
  });

  describe('pago_movil', () => {
    const messy = {
      paymentReference: '0012345678901', // 13 dígitos
      debitPhone: '0414-638-0056',
      originBank: '0114',
      trxDate: '2026-06-22',
    };

    it('should truncar la referencia a los últimos 8 dígitos y normalizar teléfono y banco', async () => {
      await adapter.createPayment({
        applicationId: 'app1',
        method: 'pago_movil',
        invoiceNumber: 'CLI-2026-000038',
        amount: '6.71',
        methodData: { ...messy },
      });
      const body = lastBody();
      expect(body.paymentreference).toBe('45678901'); // últimos 8 de 13 dígitos
      expect(body.debitphone).toBe('584146380056');
      expect(body.origenbank).toBe(114);
      expect(body.trxdate).toBe('2026-06-22');
    });

    it('should mandar en el polling (getStatus) los mismos valores normalizados que en la creación', async () => {
      await adapter.createPayment({
        applicationId: 'app1',
        method: 'pago_movil',
        invoiceNumber: 'CLI-1',
        amount: '6.71',
        methodData: { ...messy },
      });
      const createBody = lastBody();

      await adapter.getStatus({
        applicationId: 'app1',
        method: 'pago_movil',
        invoiceNumber: 'CLI-1',
        amount: '6.71',
        methodData: { ...messy },
      });
      const pollBody = lastBody();

      expect(pollBody.debitphone).toBe(createBody.debitphone);
      expect(pollBody.paymentreference).toBe(createBody.paymentreference);
      expect(pollBody.debitphone).toBe('584146380056');
      expect(pollBody.paymentreference).toBe('45678901');
    });
  });

  describe('transfer', () => {
    it('should normalizar la cédula con separadores y conservar la referencia de 8 dígitos', async () => {
      await adapter.createPayment({
        applicationId: 'app1',
        method: 'transfer',
        invoiceNumber: 'CLI-2',
        amount: '6.71',
        methodData: {
          paymentReference: '55803108',
          originDni: 'v-30.749.551',
          originBank: '0114',
          trxDate: '2026-06-22',
        },
      });
      const body = lastBody();
      expect(body.origendni).toBe('V30749551');
      expect(body.paymentreference).toBe('55803108');
      expect(body.origenbank).toBe(114);
    });
  });

  describe('c2p', () => {
    it('should asumir V cuando la cédula viene solo con dígitos y normalizar el teléfono', async () => {
      await adapter.createPayment({
        applicationId: 'app1',
        method: 'c2p',
        invoiceNumber: 'CLI-3',
        amount: '6.62',
        methodData: {
          destinationId: '30749551',
          destinationMobileNumber: '584146380056',
          destinationBank: '0102',
        },
      });
      const body = lastBody();
      expect(body.destinationid).toBe('V30749551');
      expect(body.destinationmobilenumber).toBe('584146380056');
      // El banco que teclea el cliente (0102) es el EMISOR → issuingbank.
      expect(body.issuingbank).toBe(102);
      // destinationbank = banco receptor del comercio (acquirerBank del terminal, 134 en el mock).
      expect(body.destinationbank).toBe(134);
    });
  });

  describe('validaciones que rechazan input mal formado', () => {
    it('should rechazar una referencia sin dígitos', async () => {
      await expect(
        adapter.createPayment({
          applicationId: 'app1',
          method: 'pago_movil',
          invoiceNumber: 'CLI-4',
          amount: '6.71',
          methodData: {
            paymentReference: 'abc',
            debitPhone: '04146380056',
            originBank: '0114',
            trxDate: '2026-06-22',
          },
        }),
      ).rejects.toThrow(/Referencia de pago inválida/);
    });

    it('should rechazar una fecha con formato distinto a YYYY-MM-DD', async () => {
      await expect(
        adapter.createPayment({
          applicationId: 'app1',
          method: 'transfer',
          invoiceNumber: 'CLI-5',
          amount: '6.71',
          methodData: {
            paymentReference: '55803108',
            originDni: 'V30749551',
            originBank: '0114',
            trxDate: '22/06/2026',
          },
        }),
      ).rejects.toThrow(/Fecha de transacción inválida/);
    });

    it('should rechazar un teléfono que no es un número venezolano válido', async () => {
      await expect(
        adapter.createPayment({
          applicationId: 'app1',
          method: 'pago_movil',
          invoiceNumber: 'CLI-6',
          amount: '6.71',
          methodData: {
            paymentReference: '55803108',
            debitPhone: '12345',
            originBank: '0114',
            trxDate: '2026-06-22',
          },
        }),
      ).rejects.toThrow(/Teléfono inválido/);
    });
  });

  describe('card (Botón Mercantil)', () => {
    it('should procesar crédito (TDC) en un solo setPay con los campos normalizados', async () => {
      const r = await adapter.createPayment({
        applicationId: 'app1',
        method: 'card',
        invoiceNumber: 'CLI-2026-000038',
        amount: '10.00',
        methodData: {
          cardType: 'credit',
          cardNumber: '5897-8754-2135-4688',
          expirationDate: '11/27',
          cvv: '043',
          customerId: '30749551',
        },
      });
      const body = lastCamelBody();
      expect(lastCamelPath()).toBe('/s4/sitefAuth/setPay');
      expect(body.paymentMethod).toBe('TDC');
      expect(body.cardNumber).toBe('5897875421354688');
      expect(body.expirationDate).toBe('2027/11');
      expect(body.cvv).toBe('043'); // string: conserva el cero a la izquierda
      expect(body.customerId).toBe('V30749551');
      expect(body.currency).toBe('VES');
      // invoiceNumber compactado a ≤12 chars (Mercantil error 0071): CLI-2026-000038 → 2026000038
      expect(body.invoiceNumber).toBe('2026000038');
      expect(String(body.invoiceNumber).length).toBeLessThanOrEqual(12);
      expect(body.accountType).toBeUndefined();
      expect(r.status).toBe('succeeded');
    });

    it('should autenticar débito (TDD) con getAuth y devolver requires_otp sin CVV', async () => {
      const r = await adapter.createPayment({
        applicationId: 'app1',
        method: 'card',
        invoiceNumber: 'CLI-10',
        amount: '10.00',
        methodData: { cardType: 'debit', cardNumber: '5897875421354688', customerId: 'V30749551' },
      });
      const body = lastCamelBody();
      expect(lastCamelPath()).toBe('/s4/sitefAuth/getAuth');
      expect(body.paymentMethod).toBe('TDD');
      expect(body.cvv).toBeUndefined();
      expect(r.status).toBe('requires_otp');
    });

    it('should finalizar débito en submitOtp con setPay + twofactor_auth y tipo de cuenta', async () => {
      const r = await adapter.submitOtp({
        applicationId: 'app1',
        method: 'card',
        invoiceNumber: 'CLI-10',
        amount: '10.00',
        otp: '80098630',
        methodData: {
          cardNumber: '5897875421354688',
          customerId: 'V30749551',
          expirationDate: '2027/11',
          cvv: '123',
          accountType: 'CA',
        },
      });
      const body = lastCamelBody();
      expect(lastCamelPath()).toBe('/s4/sitefAuth/setPay');
      expect(body.paymentMethod).toBe('TDD');
      expect(body.twofactor_auth).toBe('80098630');
      expect(body.accountType).toBe('CA');
      expect(r.status).toBe('succeeded');
    });

    it('should mapear error_list de Mercantil a failed exponiendo código y descripción', async () => {
      postCamelMock.mockImplementationOnce((_path: string, _creds: unknown, body: Record<string, unknown>) => ({
        request: body,
        response: { data: { error_list: [{ error_code: '80', description: 'Numero de tarjeta incorrecto' }] } },
      }));
      const r = await adapter.createPayment({
        applicationId: 'app1',
        method: 'card',
        invoiceNumber: 'CLI-11',
        amount: '10.00',
        methodData: {
          cardType: 'credit',
          cardNumber: '5897875421354688',
          expirationDate: '2027/11',
          cvv: '123',
          customerId: 'V30749551',
        },
      });
      expect(r.status).toBe('failed');
      expect(r.failureCode).toBe('MERCANTIL_80');
      expect(r.failureMessage).toBe('Numero de tarjeta incorrecto');
    });

    it('should rechazar número de tarjeta y CVV inválidos', async () => {
      await expect(
        adapter.createPayment({
          applicationId: 'app1',
          method: 'card',
          invoiceNumber: 'CLI-12',
          amount: '10.00',
          methodData: {
            cardType: 'credit',
            cardNumber: '123',
            expirationDate: '2027/11',
            cvv: '123',
            customerId: 'V30749551',
          },
        }),
      ).rejects.toThrow(/tarjeta/i);
    });
  });
  /**
   * Regresión del doble-cobro: Sitef puede devolver `messages[]` a nivel raíz JUNTO a una
   * transacción válida (la original, ya consumida por otra factura). Antes se leía solo
   * `transaction_list` y el cobro se aprobaba por segunda vez.
   */
  describe('rechazos que Sitef reporta en messages[]', () => {
    const pagoMovilData = {
      paymentReference: '18744753',
      debitPhone: '04146380056',
      originBank: '0134',
      trxDate: '2026-07-20',
    };

    const createPagoMovil = (invoiceNumber = 'CLI-2026-000048') =>
      adapter.createPayment({
        applicationId: 'app1',
        method: 'pago_movil',
        invoiceNumber,
        amount: '6.71',
        methodData: pagoMovilData,
      });

    it('should rechazar una transacción duplicada aunque venga con transaction_list', async () => {
      postMock.mockResolvedValue({
        request: {},
        response: {
          data: {
            marcada: 'verified',
            transaction_list: [{ payment_reference: 744753, invoice_number: 'CLI-2026-000044' }],
          },
          messages: [
            { field: 'Transaccion duplicada', message: 'Transacción ya procesada anteriormente. Referencia: 744753' },
          ],
        },
      });

      const r = await createPagoMovil();

      expect(r.status).toBe('failed');
      expect(r.failureCode).toBe('REFERENCE_ALREADY_USED');
      expect(r.failureMessage).toBe('Transacción ya procesada anteriormente. Referencia: 744753');
    });

    it('should mostrar solo `message`, nunca el `field` técnico de Sitef', async () => {
      postMock.mockResolvedValue({
        request: {},
        response: {
          code: 400,
          status: 'Error',
          data: {},
          messages: [{ field: 'issuingBank', message: 'Banco emisor no autorizado para débito inmediato' }],
        },
      });

      const r = await adapter.createPayment({
        applicationId: 'app1',
        method: 'c2p',
        invoiceNumber: 'CLI-2026-000045',
        amount: '6.71',
        methodData: {
          destinationId: 'V30749551',
          destinationMobileNumber: '04145380056',
          destinationBank: '0105',
        },
      });

      expect(r.status).toBe('failed');
      expect(r.failureMessage).toBe('Banco emisor no autorizado para débito inmediato');
      expect(r.failureMessage).not.toContain('issuingBank');
    });

    it('should rechazar cuando Sitef ligó la referencia a otra factura, sin messages[]', async () => {
      postMock.mockResolvedValue({
        request: {},
        response: {
          data: { transaction_list: [{ payment_reference: 744753, invoice_number: 'CLI-2026-000044' }] },
        },
      });

      const r = await createPagoMovil('CLI-2026-000048');

      expect(r.status).toBe('failed');
      expect(r.failureCode).toBe('REFERENCE_ALREADY_USED');
      expect(r.failureMessage).toContain('CLI-2026-000044');
    });

    it('should aprobar cuando la factura devuelta por Sitef es la nuestra', async () => {
      postMock.mockResolvedValue({
        request: {},
        response: {
          data: { transaction_list: [{ payment_reference: 744753, invoice_number: 'CLI-2026-000048' }] },
        },
      });

      const r = await createPagoMovil('CLI-2026-000048');

      expect(r.status).toBe('succeeded');
    });

    it('should marcar el poll como failed (no pending) ante un duplicado', async () => {
      postMock.mockResolvedValue({
        request: {},
        response: {
          data: { transaction_list: [{ payment_reference: 744753, invoice_number: 'CLI-2026-000044' }] },
          messages: [{ field: 'Transaccion duplicada', message: 'Transacción ya procesada anteriormente.' }],
        },
      });

      const r = await adapter.getStatus({
        applicationId: 'app1',
        method: 'pago_movil',
        invoiceNumber: 'CLI-2026-000048',
        amount: '6.71',
        methodData: pagoMovilData,
      });

      expect(r.status).toBe('failed');
      expect(r.failureMessage).toBe('Transacción ya procesada anteriormente.');
    });

    it('should propagar el mensaje de Sitef en tarjeta Mercantil', async () => {
      postCamelMock.mockResolvedValue({
        request: {},
        response: { data: {}, messages: [{ field: 'cardNumber', message: 'Tarjeta no afiliada al servicio' }] },
      });

      const r = await adapter.createPayment({
        applicationId: 'app1',
        method: 'card',
        invoiceNumber: 'CLI-2026-000048',
        amount: '6.71',
        methodData: {
          cardType: 'credit',
          cardNumber: '4111111111111111',
          expirationDate: '2027/11',
          cvv: '123',
          customerId: 'V30749551',
        },
      });

      expect(r.status).toBe('failed');
      expect(r.failureMessage).toBe('Tarjeta no afiliada al servicio');
    });
  });

  /**
   * Dialecto Mercantil del débito inmediato (NO documentado): con terminal adquirido por
   * Mercantil, setDebitInmediatoSitef responde transactionKeyInfoResponse (camelCase) con un
   * authenticationToken de sesión, en vez del transaction_c2p_response documentado. Regresión
   * real: la app trataba esta respuesta como NO_RESPONSE y fallaba el pago con la OTP ya enviada.
   */
  describe('débito inmediato — dialecto Mercantil (transactionKeyInfoResponse)', () => {
    const keyInfoResponse = {
      code: 200,
      status: 'OK',
      data: {
        processingDate: '2026-08-17 08:41:27 VET',
        merchantIdentify: { merchantId: 6232002, terminalId: '1', integratorId: 1 },
        transactionKeyInfoResponse: {
          trxStatus: 'Solicitud realizada exitosamente',
          invoiceNumber: { number: 'FAC-1786970487121', invoiceCreationDate: '2026-08-17' },
          referenceNumber: 63314648126,
          authenticationToken: 'WHNOpdWrZv3T6HYCR/blob-cifrado',
        },
      },
    };

    const c2pInput = {
      applicationId: 'app1',
      method: 'c2p' as const,
      invoiceNumber: 'CLI-2026-000061',
      amount: '6.71',
      methodData: {
        destinationId: 'V30749551',
        destinationMobileNumber: '04146380056',
        destinationBank: '0105',
      },
    };

    it('should mapear la solicitud de clave a requires_otp guardando token y referencia', async () => {
      postMock.mockResolvedValue({ request: {}, response: keyInfoResponse });

      const r = await adapter.createPayment(c2pInput);

      expect(r.status).toBe('requires_otp');
      expect(r.gatewayReference).toBe('63314648126');
      expect(r.methodDataPatch).toEqual({
        mercantilAuthToken: 'WHNOpdWrZv3T6HYCR/blob-cifrado',
        mercantilReferenceNumber: '63314648126',
        sitefInvoiceNumber: 'FAC-1786970487121',
      });
    });

    it('should reenviar authenticationtoken y referencenumber junto con la OTP', async () => {
      postMock.mockResolvedValue({
        request: {},
        response: {
          data: { transaction_c2p_response: { trx_status: 'approved', payment_reference: 987 } },
        },
      });

      const r = await adapter.submitOtp({
        applicationId: 'app1',
        method: 'c2p',
        invoiceNumber: 'CLI-2026-000061',
        amount: '6.71',
        otp: '12345678',
        methodData: {
          ...c2pInput.methodData,
          mercantilAuthToken: 'WHNOpdWrZv3T6HYCR/blob-cifrado',
          mercantilReferenceNumber: '63314648126',
        },
      });

      const body = lastBody();
      expect(body.otp).toBe('12345678');
      expect(body.authenticationtoken).toBe('WHNOpdWrZv3T6HYCR/blob-cifrado');
      expect(body.referencenumber).toBe('63314648126');
      expect(r.status).toBe('succeeded');
    });

    it('should NO incluir campos Mercantil cuando el terminal es Banesco (sin token en methodData)', async () => {
      postMock.mockResolvedValue({
        request: {},
        response: {
          data: { transaction_c2p_response: { trx_status: 'approved', payment_reference: 987 } },
        },
      });

      await adapter.submitOtp({
        applicationId: 'app1',
        method: 'c2p',
        invoiceNumber: 'CLI-2026-000032',
        amount: '6.62',
        otp: '80098630',
        methodData: c2pInput.methodData,
      });

      const body = lastBody();
      expect(body.authenticationtoken).toBeUndefined();
      expect(body.referencenumber).toBeUndefined();
    });

    it('should fallar (no requires_otp) si la ejecución con OTP devuelve otra solicitud de clave', async () => {
      postMock.mockResolvedValue({ request: {}, response: keyInfoResponse });

      const r = await adapter.submitOtp({
        applicationId: 'app1',
        method: 'c2p',
        invoiceNumber: 'CLI-2026-000061',
        amount: '6.71',
        otp: '12345678',
        methodData: { ...c2pInput.methodData, mercantilAuthToken: 'tok', mercantilReferenceNumber: '1' },
      });

      expect(r.status).toBe('failed');
      expect(r.failureCode).toBe('MERCANTIL_C2P_NO_CONFIRMATION');
    });

    it('should fallar con el trxStatus de Sitef si la solicitud de clave no fue exitosa', async () => {
      postMock.mockResolvedValue({
        request: {},
        response: {
          data: {
            transactionKeyInfoResponse: { trxStatus: 'Cliente no afiliado al servicio', referenceNumber: 1 },
          },
        },
      });

      const r = await adapter.createPayment(c2pInput);

      expect(r.status).toBe('failed');
      expect(r.failureMessage).toBe('Cliente no afiliado al servicio');
    });
  });
});
