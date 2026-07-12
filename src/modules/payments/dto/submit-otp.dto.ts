import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Length, IsObject, IsString, IsOptional } from 'class-validator';

export class SubmitOtpDto {
  @ApiProperty()
  @IsString()
  @Length(4, 16)
  otp: string;

  @ApiPropertyOptional({
    description:
      'Datos del método reenviados por el cliente para finalizar el pago (ej. tarjeta ' +
      'Mercantil en débito: cardNumber, expirationDate, cvv, accountType). NO se persisten.',
  })
  @IsObject()
  @IsOptional()
  methodData?: Record<string, unknown>;
}
