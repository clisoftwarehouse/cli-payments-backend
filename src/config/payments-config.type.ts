export type PaymentsConfig = {
  encryptionKey: string;
  checkoutTokenSecret: string;
  checkoutTokenExpiresIn: string;
  checkoutBaseUrl: string;
  rateLimitPerHour: number;
  webhookSigningVersion: string;
  webhookRetryBackoffSeconds: number[];
  pollingBackoffSeconds: number[];
};
