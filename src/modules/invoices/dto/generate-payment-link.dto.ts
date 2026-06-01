import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsUUID,
  IsEmail,
  IsString,
  MaxLength,
  IsOptional,
  IsNumberString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { IdentityType } from '@/modules/customers/domain/customer';

export class PaymentLinkCustomerDto {
  @ApiProperty({ example: 'cliente@empresa.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Juan Pérez / Empresa XYZ C.A.' })
  @IsString()
  @MaxLength(240)
  fullName: string;

  @ApiPropertyOptional({ example: '+58 412 0000000' })
  @IsString()
  @MaxLength(40)
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: ['rif', 'cedula', 'passport', 'nif', 'other'] })
  @IsIn(['rif', 'cedula', 'passport', 'nif', 'other'])
  @IsOptional()
  identityType?: IdentityType;

  @ApiPropertyOptional({ example: 'J-12345678-9' })
  @IsString()
  @MaxLength(60)
  @IsOptional()
  identityValue?: string;
}

export class GeneratePaymentLinkDto {
  @ApiProperty({ description: 'UUID de la aplicación (cliente/proyecto) al que pertenece este cobro.' })
  @IsUUID()
  applicationId: string;

  @ApiProperty({ description: 'Monto en EUR (referencial). Se cobra el equivalente en VES a tasa BCV del día.', example: '150.00' })
  @IsNumberString()
  amount: string;

  @ApiProperty({ description: 'Descripción del servicio o concepto cobrado (aparece en la factura).', example: 'Desarrollo de módulo de reportes — Sprint 3' })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiPropertyOptional({ description: 'Notas adicionales visibles en la factura.' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Datos del cliente destinatario del cobro.' })
  @ValidateNested()
  @Type(() => PaymentLinkCustomerDto)
  customer: PaymentLinkCustomerDto;
}
