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

    try {
      const response = await axios.post<SitefOperationResponse>(url, fullBody, {
        timeout: config.timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer,
        },
      });
      return { request: this.maskRequest(fullBody), response: response.data };
    } catch (err) {
      const axErr = err as AxiosError<SitefOperationResponse>;
      this.logger.error(`Sitef ${path} fallo: ${axErr.message} ${JSON.stringify(axErr.response?.data ?? {})}`);
      throw err;
    }
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

    try {
      const response = await axios.post<SitefOperationResponse>(url, fullBody, {
        timeout: config.timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearer,
        },
      });
      return { request: this.maskRequest(fullBody), response: response.data };
    } catch (err) {
      const axErr = err as AxiosError<SitefOperationResponse>;
      this.logger.error(`Sitef ${path} fallo: ${axErr.message} ${JSON.stringify(axErr.response?.data ?? {})}`);
      throw err;
    }
  }

  private maskRequest(body: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = { ...body };
    if (typeof masked.token === 'string') {
      masked.token = `${(masked.token as string).slice(0, 6)}…`;
    }
    return masked;
  }
}
