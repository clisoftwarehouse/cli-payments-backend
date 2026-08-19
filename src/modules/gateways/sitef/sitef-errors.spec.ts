import { extractSitefError } from './sitef-errors';
import { SitefOperationResponse } from './sitef.types';

const resp = (body: unknown) => body as SitefOperationResponse;

/**
 * Sitef responde errores en cuatro formatos distintos y a veces con metadata pegada al mensaje.
 * Estos casos son payloads REALES de producción: lo que el cliente ve en la landing sale de aquí.
 */
describe('extractSitefError', () => {
  it('should devolver null cuando la respuesta no trae error', () => {
    expect(extractSitefError(resp({ data: { transaction_list: [{ payment_reference: 1 }] } }))).toBeNull();
  });

  it('should ignorar error_list con entradas vacías (Sitef las manda en respuestas exitosas)', () => {
    // La doc de getZelleSitef muestra `error_list: [{}]` junto a una transacción aprobada:
    // tratarlo como error convertiría un cobro bueno en fallido.
    const r = extractSitefError(resp({ data: { transaction_list: [{ payment_reference: 1 }], error_list: [{}] } }));
    expect(r).toBeNull();
  });

  it('should traducir un código del catálogo a texto accionable', () => {
    const r = extractSitefError(
      resp({ data: { error_list: [{ error_code: '80', description: 'Numero de tarjeta incorrecto' }] } }),
    );
    expect(r?.code).toBe('80');
    expect(r?.message).toBe('El número de tarjeta es incorrecto. Verifícalo e intenta de nuevo.');
  });

  it('should traducir saldo insuficiente sin exponer el código', () => {
    const r = extractSitefError(
      resp({ data: { error_list: [{ error_code: '374', description: 'Saldo insuficiente' }] } }),
    );
    expect(r?.message).toBe('Fondos insuficientes en la cuenta.');
  });

  it('should reconocer el código con ceros a la izquierda (0071 visto en producción)', () => {
    const r = extractSitefError(
      resp({ data: { error_list: [{ error_code: '0071', description: 'Numero de factura muy largo' }] } }),
    );
    expect(r?.message).toBe('El número de factura es demasiado largo.');
  });

  it('should NO volcar la metadata de la transacción en el mensaje (caso real: fraude)', () => {
    // Regresión: se mostraba "TRANSACCIÓN SOSPECHOSA DE FRAUDE — id: 64dcb642-...; status:
    // cancelled; terminal: 4898; createdAt: ...; lotNumber: 01".
    const r = extractSitefError(
      resp({
        data: {
          message: 'TRANSACCIÓN SOSPECHOSA DE FRAUDE',
          data: {
            id: '64dcb642-9077-4e54-9434-e309948f021b',
            status: 'cancelled',
            terminal: '4898',
            createdAt: '2026-08-19T17:33:05.973Z',
            lotNumber: '01',
          },
        },
      }),
    );
    expect(r?.message).toBe(
      'Transacción sospechosa de fraude. Comunícate con tu banco para autorizarla o intenta con otra tarjeta.',
    );
    expect(r?.message).not.toMatch(/64dcb642|lotNumber|createdAt|terminal/);
  });

  it('should conservar el detalle cuando SÍ es un error de campo de entrada (caso real: pin)', () => {
    const r = extractSitefError(
      resp({
        data: {
          code: 'INVALID_DATA',
          message: 'Datos invalidos',
          data: { pin: 'Debe tener al menos 4 caracteres' },
        },
      }),
    );
    expect(r?.message).toBe('Datos invalidos (pin: Debe tener al menos 4 caracteres)');
  });

  it('should conservar el mensaje de Sitef cuando ya es legible y trae datos útiles', () => {
    // No sustituir: la referencia le sirve al cliente para identificar el pago.
    const r = extractSitefError(
      resp({
        messages: [
          { field: 'Transaccion duplicada', message: 'Transacción ya procesada anteriormente. Referencia: 744753' },
        ],
        data: {},
      }),
    );
    expect(r?.message).toBe('Transacción ya procesada anteriormente. Referencia: 744753');
  });

  it('should mostrar solo `message`, nunca el `field` técnico', () => {
    const r = extractSitefError(
      resp({
        messages: [{ field: 'issuingBank', message: 'Banco emisor no autorizado para débito inmediato' }],
        data: {},
      }),
    );
    expect(r?.message).toContain('Banco emisor no autorizado para débito inmediato');
    expect(r?.message).not.toContain('issuingBank');
  });

  it('should añadir guía accionable a un rechazo que no dice qué hacer', () => {
    const r = extractSitefError(
      resp({
        messages: [{ field: 'issuingBank', message: 'Banco emisor no autorizado para débito inmediato' }],
        data: {},
      }),
    );
    expect(r?.message).toBe(
      'Banco emisor no autorizado para débito inmediato. Prueba con otro banco o método de pago.',
    );
  });

  it('should dar un mensaje genérico legible cuando Sitef no explica nada', () => {
    const r = extractSitefError(resp({ data: { error_list: [{ error_code: 'ZZZ' }] } }));
    expect(r?.message).toBe('El banco rechazó la transacción.');
  });
});
