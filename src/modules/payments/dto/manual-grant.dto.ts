import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Force-grant (admin): marca una factura como pagada SIN cobrar — registra un pago
 * `manual`/out-of-band y dispara los mismos eventos (invoice.paid → otorga suscripción).
 * Para errores, equivocaciones del cliente, o pruebas donde Sitef no puede validar.
 */
export class ManualGrantDto {
  @ApiProperty({ description: 'UUID de la factura (open) a otorgar.' })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({ description: 'Motivo del otorgamiento manual (queda en auditoría). Obligatorio.' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
