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

  beforeEach(() => {
    postMock = jest.fn((_path: string, _creds: unknown, body: Record<string, unknown>) => ({
      request: body,
      response: okResponse,
    }));

    const client = { post: postMock, postCamel: jest.fn() } as unknown as SitefClient;
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
      expect(body.destinationbank).toBe(102);
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
});
