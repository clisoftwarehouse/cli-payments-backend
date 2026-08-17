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

/**
 * Variante Mercantil del débito inmediato — NO DOCUMENTADA en API_SITEF_documentacion.md.
 *
 * Observada en producción (agosto 2026) al llamar `setDebitInmediatoSitef` con un terminal
 * cuyo adquiriente es Mercantil (idbranch 980): en vez del `transaction_c2p_response`
 * documentado, Sitef enruta por el motor C2P de Mercantil y responde camelCase con una
 * "solicitud de clave": `trxStatus: "Solicitud realizada exitosamente"`, un `invoiceNumber`
 * propio generado por Sitef (FAC-...), un `referenceNumber` y un `authenticationToken`
 * (blob cifrado de sesión) que presumiblemente debe reenviarse al ejecutar el débito.
 * Los terminales adquiridos por Banesco (idbranch 117) siguen el contrato documentado.
 */
export type SitefTransactionKeyInfoResponse = {
  trxStatus?: string;
  invoiceNumber?: {
    number?: string;
    invoiceCreationDate?: string;
    invoiceCancelledDate?: string;
  };
  referenceNumber?: number | string;
  authenticationToken?: string;
};

/**
 * Aviso a nivel raíz de la respuesta (hermano de `data`, NO dentro de él).
 * Sitef lo usa para rechazos que igual devuelven `transaction_list`, el caso crítico
 * siendo `field: "Transaccion duplicada"` — la referencia ya se consumió en otra factura.
 * El `message` viene redactado para el cliente final: se muestra tal cual en pantalla.
 */
export type SitefMessage = {
  field?: string;
  message?: string;
};

export type SitefOperationResponse = {
  code?: number;
  status?: string;
  messages?: SitefMessage[];
  data: {
    merchant_identify: SitefMerchantIdentify;
    transaction_c2p_response?: SitefTransactionC2pResponse;
    transactionKeyInfoResponse?: SitefTransactionKeyInfoResponse;
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
