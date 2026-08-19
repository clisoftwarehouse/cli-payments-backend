import { SitefOperationResponse } from './sitef.types';

/**
 * Normalización de errores de Sitef.
 *
 * Sitef responde errores en CUATRO formatos distintos según el endpoint y el motor bancario
 * (documentados y no documentados), y algunos vienen en MAYÚSCULAS o acompañados de metadata
 * de la transacción. Este módulo los unifica en `{ code, message }` y traduce lo conocido a
 * texto que un cliente final entienda.
 *
 * Formatos observados:
 *  1. `data.error_list[]` → `{ error_code, description }`  (catálogo Mercantil, el más común)
 *  2. `messages[]` a nivel raíz → `{ field, message }`     (duplicados, banco no autorizado)
 *  3. `data.{ code, message, data:{campo: motivo} }`       (validación CCR/Credicard)
 *  4. `data.message` suelto                                (rechazos CCR con metadata adjunta)
 */
export type SitefErrorInfo = {
  /** Código técnico de Sitef si vino (ej. "80", "4000"). Se guarda para soporte, no se muestra. */
  code: string | null;
  /** Texto ya listo para mostrar al cliente. */
  message: string;
};

/**
 * Catálogo del manual Mercantil (sección "Tipos de Errores") + códigos vistos en producción.
 * La descripción oficial suele ser para el integrador ("Verificar los dígitos de la tarjeta");
 * aquí se reescribe en segunda persona y con la acción que puede tomar el cliente.
 */
const ERROR_CATALOG: Record<string, string> = {
  // Tarjeta
  '80': 'El número de tarjeta es incorrecto. Verifícalo e intenta de nuevo.',
  '9013': 'Esa tarjeta no existe. Verifica el número e intenta de nuevo.',
  '120': 'La tarjeta está vencida. Usa otra tarjeta.',
  '110': 'La fecha de vencimiento no es válida. Revisa el mes y el año.',
  '130': 'El código de seguridad (CVV) es incorrecto.',
  '230': 'El código de seguridad (CVV) no pudo validarse. Verifícalo e intenta de nuevo.',

  // Cuenta
  '140': 'El tipo de cuenta no corresponde a tu tarjeta. Verifica si es corriente o de ahorro.',
  '200': 'El tipo de cuenta seleccionado no existe. Elige corriente o ahorro.',
  '311': 'No tienes una cuenta de ese tipo asociada a la tarjeta. Prueba con el otro tipo de cuenta.',

  // Fondos y límites
  '364': 'Fondos insuficientes en la cuenta.',
  '374': 'Fondos insuficientes en la cuenta.',
  '375': 'Fondos insuficientes en la cuenta.',
  '376': 'Fondos insuficientes en la cuenta.',
  '365': 'Superaste el límite permitido por tu banco para esta operación.',
  '369': 'Superaste el límite de débitos permitido por tu banco.',

  // Clave / segundo factor
  '150': 'La clave ingresada es incorrecta.',
  '240': 'La clave no pudo validarse. Intenta de nuevo.',
  '245': 'La clave es incorrecta. Si fallas varias veces tu banco puede bloquearla.',
  '9014': 'La clave es incorrecta. Cuidado: al superar el máximo de intentos tu banco la bloquea.',
  '9015': 'Tu banco bloqueó la clave por superar el máximo de intentos. Contáctalo para desbloquearla.',

  // Monto / moneda
  '160': 'El monto de la transacción no es válido.',
  '371': 'El monto ingresado no es correcto.',
  '170': 'El código de moneda es incorrecto.',
  '190': 'El código de moneda no existe.',

  // Factura / duplicados
  '210': 'Esta factura ya fue procesada anteriormente.',
  '70': 'Falta el número de factura.',
  '71': 'El número de factura es demasiado largo.',
  '0071': 'El número de factura es demasiado largo.',

  // Identificación
  '90': 'Falta la cédula del titular.',
  '91': 'La cédula del titular es demasiado larga.',

  // Sesión del débito inmediato vía Mercantil
  '4000': 'La sesión de pago expiró o es inválida. Vuelve a solicitar la clave.',

  // Búsqueda / verificación
  '330': 'No se encontró la transacción con los datos indicados.',
  '310': 'Faltan datos para ubicar la transacción (número de factura o referencia).',
  '320': 'Los datos de búsqueda no son válidos.',
};

/**
 * Guía que se AÑADE al mensaje de Sitef cuando este describe el problema pero no dice qué hacer
 * (ej. "TRANSACCIÓN SOSPECHOSA DE FRAUDE"). No sustituye el texto original: los mensajes de Sitef
 * suelen traer datos útiles (referencias, montos) que no queremos perder.
 */
const GUIDANCE_PATTERNS: Array<{ match: string; guidance: string }> = [
  { match: 'fraude', guidance: 'Comunícate con tu banco para autorizarla o intenta con otra tarjeta.' },
  { match: 'insuficiente', guidance: 'Verifica el saldo disponible o usa otro método de pago.' },
  { match: 'vencida', guidance: 'Usa otra tarjeta.' },
  { match: 'excedido', guidance: 'Intenta con un monto menor o contacta a tu banco.' },
  { match: 'bloquead', guidance: 'Contacta a tu banco para desbloquearla.' },
  { match: 'no autorizado', guidance: 'Prueba con otro banco o método de pago.' },
];

/**
 * Campos de ENTRADA cuyo detalle sí es útil mostrar cuando Sitef devuelve validaciones por campo.
 * Whitelist a propósito: el mismo nodo `data` a veces trae metadata de la transacción
 * (id, status, terminal, createdAt, lotNumber) que no significa nada para el cliente — volcarla
 * producía mensajes como "TRANSACCIÓN SOSPECHOSA DE FRAUDE — id: 64dcb...; lotNumber: 01".
 */
const REPORTABLE_FIELDS = new Set([
  'pin',
  'cvc',
  'cvv',
  'otp',
  'amount',
  'accountType',
  'cardNumber',
  'monthExp',
  'yearExp',
  'expirationDate',
  'documentoCliente',
  'tipoDocumento',
  'cardHolderName',
  'invoiceNumber',
]);

/** Extrae el error de cualquiera de los formatos de Sitef. `null` si la respuesta no trae error. */
export function extractSitefError(response: SitefOperationResponse): SitefErrorInfo | null {
  // 1. error_list — ignorando entradas vacías: en respuestas EXITOSAS Sitef incluye
  //    `error_list: [{}]` (ver ejemplo de getZelleSitef en la doc). Tratarlo como error
  //    convertiría un cobro bueno en fallido.
  const listed = (response.data?.error_list ?? []).find((e) => e && (e.error_code || e.description));
  if (listed) {
    return build(listed.error_code ?? null, listed.description ?? null);
  }

  // 2. messages[] a nivel raíz. Solo `message` es para el cliente; `field` es técnico
  //    ("issuingBank", "Transaccion duplicada") y sirve para clasificar.
  const messages = (response.messages ?? []).filter((m) => m?.message || m?.field);
  if (messages.length > 0) {
    const text = messages
      .map((m) => m.message?.trim())
      .filter((m): m is string => !!m)
      .join(' ');
    const fieldHint = messages.map((m) => m.field ?? '').join(' ');
    return build(null, text || null, fieldHint);
  }

  // 3 y 4. Error anidado de Credicard: { code, message, data: {...} }.
  const nested = response.data as unknown as { code?: unknown; message?: unknown; data?: unknown } | undefined;
  if (nested && typeof nested.message === 'string') {
    const code = typeof nested.code === 'string' ? nested.code : null;
    return build(code, nested.message, '', fieldDetails(nested.data));
  }

  return null;
}

/** Detalle por campo, solo para campos de entrada conocidos (nunca metadata de la transacción). */
function fieldDetails(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  return Object.entries(data as Record<string, unknown>)
    .filter(([k, v]) => REPORTABLE_FIELDS.has(k) && typeof v === 'string')
    .map(([k, v]) => `${k}: ${v as string}`)
    .join('; ');
}

function build(code: string | null, rawMessage: string | null, extraHint = '', details = ''): SitefErrorInfo {
  // 1. Código del catálogo: redacción curada y accionable, mejor que la descripción técnica.
  const byCode = code ? (ERROR_CATALOG[code] ?? ERROR_CATALOG[code.replace(/^0+/, '')]) : undefined;
  if (byCode) return { code, message: byCode };

  // 2. Texto de Sitef, normalizado. Se conserva porque suele traer datos que no tenemos
  //    (referencia del movimiento, monto), pero sin MAYÚSCULAS sostenidas.
  let message = humanizeText(rawMessage) || 'El banco rechazó la transacción.';
  if (details) message += ` (${details})`;

  // 3. Guía accionable si el texto describe el problema pero no la salida.
  const haystack = `${message} ${extraHint}`.toLowerCase();
  const guidance = GUIDANCE_PATTERNS.find((p) => haystack.includes(p.match))?.guidance;
  if (guidance) message = `${message.replace(/[.\s]+$/, '')}. ${guidance}`;

  return { code, message };
}

/** MAYÚSCULAS SOSTENIDAS → Sentencia normal. Deja intactos los textos que ya vienen bien. */
function humanizeText(text: string | null): string {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return '';
  const letters = trimmed.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
  const isShouting = letters.length > 3 && letters === letters.toUpperCase();
  if (!isShouting) return trimmed;
  const lower = trimmed.toLocaleLowerCase('es');
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
}
