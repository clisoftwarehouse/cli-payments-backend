export type SitefTokenStrategy = 'per_request' | 'cached';

export type SitefConfig = {
  baseUrl: string;
  tokenStrategy: SitefTokenStrategy;
  tokenCacheTtlSeconds: number;
  defaultCurrency: string;
  timeoutMs: number;
};
