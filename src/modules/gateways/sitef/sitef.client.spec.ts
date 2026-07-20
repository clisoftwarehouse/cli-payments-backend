import axios from 'axios';
import { ConfigService } from '@nestjs/config';

import { SitefClient } from './sitef.client';
import { SitefCredentials } from './sitef.types';
import { SitefAuthService } from './sitef-auth.service';

jest.mock('axios');

/**
 * Un 4xx de Sitef trae el motivo redactado para el cliente final. Si el client lo propaga
 * como excepción, ese texto se pierde y el cliente ve un 500 genérico nuestro — que es
 * justo lo que pasaba con "Banco emisor no autorizado para débito inmediato".
 */
describe('SitefClient — respuestas de error de Sitef', () => {
  const creds: SitefCredentials = {
    username: 'cobeca',
    password: 'pwd',
    idBranch: 117,
    codeStall: '017',
    acquirerBank: 134,
  };

  let client: SitefClient;
  const postMock = axios.post as jest.MockedFunction<typeof axios.post>;

  const axiosError = (status: number, data: unknown) =>
    Object.assign(new Error(`Request failed with status code ${status}`), {
      isAxiosError: true,
      response: { status, data },
    });

  beforeEach(() => {
    postMock.mockReset();
    const configService = {
      getOrThrow: jest.fn(() => ({ baseUrl: 'https://sitef.test', timeoutMs: 5000 })),
    } as unknown as ConfigService;
    const auth = {
      getToken: jest.fn(() => Promise.resolve('Bearer abc')),
      bodyTokenFromBearer: jest.fn(() => 'bodytoken'),
    } as unknown as SitefAuthService;

    client = new SitefClient(configService, auth);
  });

  it('should devolver el body cuando Sitef responde 400 con messages[]', async () => {
    const body = {
      code: 400,
      status: 'Error',
      data: {},
      messages: [{ field: 'issuingBank', message: 'Banco emisor no autorizado para débito inmediato' }],
    };
    postMock.mockRejectedValue(axiosError(400, body));

    const { response } = await client.post('/s4/sitefAuth/setDebitInmediatoSitef', creds, { amount: 6.71 });

    expect(response.messages?.[0].message).toBe('Banco emisor no autorizado para débito inmediato');
  });

  it('should devolver el body cuando Sitef responde 400 con error_list', async () => {
    postMock.mockRejectedValue(
      axiosError(400, { data: { error_list: [{ error_code: '0071', description: 'Numero de factura muy largo' }] } }),
    );

    const { response } = await client.postCamel('/s4/sitefAuth/setPay', creds, { amount: 6.71 });

    expect(response.data.error_list?.[0].description).toBe('Numero de factura muy largo');
  });

  it('should relanzar un 500: no hay mensaje de Sitef que mostrar y el reintento sí aplica', async () => {
    postMock.mockRejectedValue(axiosError(500, { message: 'Internal Server Error' }));

    await expect(client.post('/s4/sitefAuth/getBusquedaSitef', creds, {})).rejects.toThrow(/500/);
  });

  it('should relanzar un 4xx sin motivo interpretable (ej. HTML de un proxy)', async () => {
    postMock.mockRejectedValue(axiosError(404, '<html>Not Found</html>'));

    await expect(client.post('/s4/sitefAuth/getBusquedaSitef', creds, {})).rejects.toThrow(/404/);
  });

  it('should relanzar un fallo de transporte sin respuesta (timeout)', async () => {
    postMock.mockRejectedValue(Object.assign(new Error('timeout of 5000ms exceeded'), { isAxiosError: true }));

    await expect(client.post('/s4/sitefAuth/getBusquedaSitef', creds, {})).rejects.toThrow(/timeout/);
  });

  it('should enmascarar token y datos de tarjeta en el request devuelto', async () => {
    postMock.mockResolvedValue({ data: { data: {} } });

    const { request } = await client.postCamel('/s4/sitefAuth/setPay', creds, {
      cardNumber: '4111111111111111',
      cvv: '123',
      expirationDate: '2027/11',
    });

    expect(request.token).toBe('bodyto…');
    expect(request.cardNumber).toBe('••••1111');
    expect(request.cvv).toBe('•••');
    expect(request.expirationDate).toBe('•••');
  });
});
