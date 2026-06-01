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

export type SitefOperationResponse = {
  code?: number;
  status?: string;
  data: {
    merchant_identify: SitefMerchantIdentify;
    transaction_c2p_response?: SitefTransactionC2pResponse;
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
