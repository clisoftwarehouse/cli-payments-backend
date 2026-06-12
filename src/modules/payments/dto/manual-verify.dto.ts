import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID, IsObject } from 'class-validator';

/**
 * Verificación manual (admin) de un pago por referencia contra Sitef, para una factura.
 * Reusa el mismo flujo que el checkout público; en éxito otorga la factura/suscripción.
 */
export class ManualVerifyDto {
  @ApiProperty({ description: 'UUID de la factura (open) a verificar.' })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({
    enum: ['transfer', 'pago_movil'],
    description: 'Métodos verificables por referencia contra Sitef. (zelle/c2p no aplican a verificación manual por referencia.)',
  })
  @IsIn(['transfer', 'pago_movil'])
  method: 'transfer' | 'pago_movil';

  @ApiProperty({
    type: Object,
    description: 'Datos del método para Sitef (ej. transfer: originBank, originDni, paymentReference, trxDate).',
  })
  @IsObject()
  methodData: Record<string, unknown>;
}
