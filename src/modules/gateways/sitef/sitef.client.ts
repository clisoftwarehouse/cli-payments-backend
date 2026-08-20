import axios, { AxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';
import { Logger, Injectable } from '@nestjs/common';

import { AllConfigType } from '@/config/config.type';
import { SitefAuthService } from './sitef-auth.service';
import { SitefConfig } from './config/sitef-config.type';
import { SitefCredentials, SitefOperationResponse } from './sitef.types';

/** Wrapper alrededor de axios que inyecta Bearer + body token y delega al adapter el armado del body. */
@Injectable()
export class SitefClient {
  private readonly logger = new Logger(SitefClient.name);

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly auth: SitefAuthService,
  ) {}

  async post(
    path: string,
    creds: SitefCredentials,
    body: Record<string, unknown>,
  ): Promise<{ request: Record<string, unknown>; response: SitefOperationResponse }> {
    const config = this.configService.getOrThrow<SitefConfig>('sitef', { infer: true });
    const bearer = await this.auth.getToken(creds.username, creds.password);
    const bodyToken = this.auth.bodyTokenFromBearer(bearer);

    const url = `${config.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const fullBody = {
      username: creds.username,
      token: bodyToken,
      idbranch: creds.idBranch,
      codestall: creds.codeStall,
      ...body,
    };

    return this.execute(path, url, fullBody, bearer, config.timeoutMs);
  }

  /** Igual que post() pero inyecta idBranch/codeStall (camelCase) en lugar de idbranch/codestall.
   *  Requerido por los endpoints CCR de Sitef (setCCRSitefApi, finalizarCCRSitef). */
  async postCamel(
    path: string,
    creds: SitefCredentials,
    body: Record<string, unknown>,
  ): Promise<{ request: Record<string, unknown>; response: SitefOperationResponse }> {
    const config = this.configService.getOrThrow<SitefConfig>('sitef', { infer: true });
    const bearer = await this.auth.getToken(creds.username, creds.password);
    const bodyToken = this.auth.bodyTokenFromBearer(bearer);

    const url = `${config.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const fullBody = {
      username: creds.username,
      token: bodyToken,
      idBranch: creds.idBranch,
      codeStall: creds.codeStall,
      ...body,
    };

    return this.execute(path, url, fullBody, bearer, config.timeoutMs);
  }

  /**
   * Un 4xx de Sitef NO es un fallo de transporte: el body trae el motivo redactado para el
   * cliente final (`messages[]`, `data.error_list[]`) — ej. 400 + "Banco emisor no autorizado
   * para débito inmediato". Antes se propagaba la excepción de axios y ese texto se perdía,
   * dejando al cliente con un 500 genérico nuestro. Ahora el body se devuelve como respuesta
   * normal para que los mappers lo conviertan en un `failed` con el mensaje de Sitef.
   *
   * Solo se relanza lo que de verdad es un fallo de transporte (timeout, DNS, 5xx, body no
   * interpretable): ahí no hay mensaje de Sitef que mostrar y el reintento sí tiene sentido.
   */
  private async execute(
    path: string,
    url: string,
    fullBody: Record<string, unknown>,
    bearer: string,
    timeoutMs: number,
  ): Promise<{ request: Record<string, unknown>; response: SitefOperationResponse }> {
    try {
      const response = await axios.post<SitefOperationResponse>(url, fullBody, {
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer,
        },
      });
      return { request: this.maskRequest(fullBody), response: response.data };
    } catch (err) {
      const axErr = err as AxiosError<SitefOperationResponse>;
      const status = axErr.response?.status;
      const data = axErr.response?.data;
      this.logger.error(`Sitef ${path} fallo (HTTP ${status ?? '—'}): ${axErr.message} ${JSON.stringify(data ?? {})}`);

      if (status && status >= 400 && status < 500 && this.hasSitefReason(data)) {
        return { request: this.maskRequest(fullBody), response: data! };
      }
      throw err;
    }
  }

  /** ¿El body trae un motivo de Sitef que podamos mostrarle al cliente? */
  /**
   * POST sin el envoltorio de autenticación de Sitef (ni Bearer, ni username/token/idBranch en
   * el body). Lo exigen los endpoints `/s1/webhook/*` de Mercantil — ver la colección oficial
   * "Debito inmediato Mercantil", donde `consulta_mercantil` solo lleva Content-Type.
   */
  async postWebhook<T>(path: string, body: Record<string, unknown>): Promise<{ response: T }> {
    const config = this.configService.getOrThrow<SitefConfig>('sitef', { infer: true });
    const url = `${config.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

    try {
      const res = await axios.post<T>(url, body, {
        timeout: config.timeoutMs,
        headers: { 'Content-Type': 'application/json' },
      });
      return { response: res.data };
    } catch (err) {
      const axErr = err as AxiosError;
      this.logger.error(`Sitef ${path} falló (HTTP ${axErr.response?.status ?? '—'}): ${axErr.message}`);
      throw err;
    }
  }

  private hasSitefReason(data: SitefOperationResponse | undefined): boolean {
    if (!data || typeof data !== 'object') return false;
    // Tercer formato de error (CCR/Credicard): { data: { code: "INVALID_DATA", message, data: {campo: motivo} } }.
    // Ej. real: pin "Debe tener al menos 4 caracteres". También es un motivo mostrable.
    const nestedMessage = (data.data as { message?: unknown } | undefined)?.message;
    return (
      (data.messages?.length ?? 0) > 0 || (data.data?.error_list?.length ?? 0) > 0 || typeof nestedMessage === 'string'
    );
  }

  private maskRequest(body: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = { ...body };
    if (typeof masked.token === 'string') {
      masked.token = `${(masked.token as string).slice(0, 6)}…`;
    }
    // Token de sesión del C2P Mercantil: es un blob de ~3KB y funciona como bearer del débito
    // en curso — truncarlo en raw_request/logs (el valor completo solo viaja a Sitef).
    for (const key of ['authenticationToken', 'authenticationtoken']) {
      if (typeof masked[key] === 'string') {
        masked[key] = `${(masked[key] as string).slice(0, 12)}…`;
      }
    }
    // Nunca guardar en crudo datos sensibles de tarjeta (raw_request de payment_attempts,
    // logs). Del PAN solo se conservan los últimos 4; CVV / 2FO / vencimiento se ocultan.
    if (masked.cardNumber != null) {
      const digits = String(masked.cardNumber).replace(/\D/g, '');
      masked.cardNumber = digits.length >= 4 ? `••••${digits.slice(-4)}` : '••••';
    }
    // `pin` (clave de la tarjeta, débito CCR) es tan sensible como el CVV. Solo se enmascara si
    // trae valor: un pin vacío debe verse vacío en raw_request para poder diagnosticar (fue
    // exactamente el bug del INVALID_DATA "pin: Debe tener al menos 4 caracteres").
    for (const key of ['cvv', 'cvc', 'twofactor_auth', 'expirationDate', 'pin']) {
      if (typeof masked[key] === 'string' && (masked[key] as string).length > 0) masked[key] = '•••';
      else if (masked[key] != null && typeof masked[key] !== 'string') masked[key] = '•••';
    }
    return masked;
  }
}
