export type PaymentMethodKind = 'c2p' | 'transfer' | 'web_button' | 'zelle' | 'pago_movil' | 'card_ccr';

export type CreatePaymentInput = {
  applicationId: string;
  method: PaymentMethodKind;
  invoiceNumber: string;
  amount: string; // numeric string, ej "23.50"
  /** Datos específicos del método. Validación se hace en el adapter. */
  methodData: Record<string, unknown>;
};

export type CreatePaymentResult = {
  /** Estado tras la creación. */
  status: 'requires_otp' | 'requires_action' | 'succeeded' | 'failed';
  /** Referencia que devuelve Sitef (paymentReference, sessionId, etc.) — guardar en payments.gateway_reference. */
  gatewayReference: string | null;
  /** URL a la que redirigir al cliente (para Web Button). */
  redirectUrl?: string;
  failureCode?: string;
  failureMessage?: string;
  rawRequest: Record<string, unknown>;
  rawResponse: Record<string, unknown>;
};

export type SubmitOtpInput = {
  applicationId: string;
  method: 'c2p' | 'card_ccr';
  invoiceNumber: string;
  amount: string;
  otp: string;
  methodData: Record<string, unknown>;
};

export type GetStatusInput = {
  applicationId: string;
  method: PaymentMethodKind;
  invoiceNumber: string;
  amount: string;
  /** Datos requeridos por el endpoint de status del adapter. */
  methodData: Record<string, unknown>;
};

export type GatewayStatusResult = {
  status: 'pending' | 'succeeded' | 'failed';
  gatewayReference: string | null;
  authorizationCode?: string;
  failureCode?: string;
  failureMessage?: string;
  rawResponse: Record<string, unknown>;
};

export abstract class PaymentGatewayPort {
  abstract createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  abstract submitOtp(input: SubmitOtpInput): Promise<CreatePaymentResult>;
  abstract getStatus(input: GetStatusInput): Promise<GatewayStatusResult>;
}
