export type SitefTokenResponse = {
  code: number;
  status: string;
  data: { username: string; token: string; idTypeUser?: number };
};

export type SitefMerchantIdentify = {
  integratorId: number;
  merchantId: number;
  terminalId: string;
};

export type SitefTransactionC2pResponse = {
  processing_date: string;
  trx_status: string; // approved | CLAVE OTP ENVIADA | rejected | ...
  trx_internal_status: string;
  trx_type: string;
  payment_method: string;
  invoice_number: string;
  amount: number;
  service_fee: number;
  currency: string;
  authorization_code?: string;
  payment_reference?: number | string;
};

/** Respuesta de `setPay` (Botón Mercantil, TDC y TDD). */
export type SitefTransactionResponse = {
  processing_date: string;
  trx_status: string; // "approved" | "rejected" | ...
  trx_type: string; // "compra"
  payment_method: string; // "TDC" | "TDD"
  payment_reference?: number | string;
  invoice_number?: string;
  amount?: number;
  currency?: string;
  trx_internal_status?: string; // "00" = ok
  authorization_code?: string;
};

/** Respuesta de `getAuth` (Botón Mercantil TDD — reto de segundo factor). */
export type SitefAuthenticationInfo = {
  processing_date: string;
  trx_status: string; // "approved" = autenticación iniciada (OTP enviado)
  trx_type: string;
  payment_method: string; // "TDD"
  twofactor_type?: string; // "otp"
  twoFactorLabel?: string;
  twoFactorFieldType?: string; // "numeric"
  twoFactorLenght?: number; // longitud del OTP (ej. 8)
};

export type SitefOperationResponse = {
  code?: number;
  status?: string;
  data: {
    merchant_identify: SitefMerchantIdentify;
    transaction_c2p_response?: SitefTransactionC2pResponse;
    transaction_response?: SitefTransactionResponse;
    authentication_info?: SitefAuthenticationInfo;
    transaction_list?: Array<{
      trx_date: string;
      trx_type: string;
      authorization_code?: string;
      payment_reference?: number | string;
      invoice_number: string;
      payment_method: string;
      origin_mobile_number?: string;
      destination_mobile_number?: string;
      destination_id?: string;
      currency: string;
      amount: number;
      destination_bank_id?: string;
    }>;
    marcada?: 'marcada' | 'verified';
    ticket?: string;
    error_list?: Array<{ error_code?: string; description?: string }>;
  };
};

export type SitefCcrCreateResponse = {
  code?: number;
  status?: string; // "READY_TO_PAY" | "OTP_REQUIRED"
  data?: {
    id?: string; // orderId
    paymentUrl?: string;
    qrData?: string;
  };
};

export type SitefCcrFinalizeResponse = {
  code?: number;
  status?: string; // "Procesado"
  data?: {
    data?: {
      receipt?: {
        result?: {
          message?: string; // "APROBADO"
        };
      };
      status?: string; // "paid"
      referenceId?: string;
    };
  };
};

export type SitefCredentials = {
  username: string;
  password: string; // claro — viene de descifrar merchant_terminal
  idBranch: number;
  codeStall: string;
  acquirerBank: number;
};
