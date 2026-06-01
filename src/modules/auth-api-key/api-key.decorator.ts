import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { ApiKeyRequest } from './api-key-auth.guard';

/** Extrae la API key autenticada del request. Requiere `ApiKeyAuthGuard`. */
export const CurrentApiKey = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<ApiKeyRequest>();
  if (!req.apiKey) {
    throw new Error('CurrentApiKey usado sin ApiKeyAuthGuard antes.');
  }
  return req.apiKey;
});
