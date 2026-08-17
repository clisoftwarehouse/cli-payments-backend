import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsIn, IsInt, IsArray, IsString, MaxLength, IsOptional } from 'class-validator';

import { TERMINAL_METHOD_KINDS, TerminalMethodKind } from './create-merchant-terminal.dto';

/** Todos los campos opcionales. `applicationId` no es editable (recrear el terminal si cambia). */
export class UpdateMerchantTerminalDto {
  @ApiPropertyOptional({ example: 'Caja Mercantil' })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({ example: 'sitef_xxxx' })
  @IsString()
  @MaxLength(120)
  @IsOptional()
  sitefUsername?: string;

  @ApiPropertyOptional({ description: 'Omitir para conservar el password actual. Se encripta antes de persistir.' })
  @IsString()
  @IsOptional()
  sitefPassword?: string;

  @ApiPropertyOptional({ example: 980 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sitefIdBranch?: number;

  @ApiPropertyOptional({ example: '001' })
  @IsString()
  @MaxLength(16)
  @IsOptional()
  sitefCodeStall?: string;

  @ApiPropertyOptional({ example: 105, description: 'Banco adquiriente (issuingbank/receivingbank).' })
  @IsInt()
  @Min(0)
  @IsOptional()
  acquirerBank?: number;

  @ApiPropertyOptional({
    isArray: true,
    enum: TERMINAL_METHOD_KINDS,
    description: 'Métodos que atiende. Enviar [] para volverlo terminal por defecto.',
  })
  @IsArray()
  @IsIn(TERMINAL_METHOD_KINDS, { each: true })
  @IsOptional()
  methodKinds?: TerminalMethodKind[];

  @ApiPropertyOptional({ nullable: true })
  @IsString()
  @IsOptional()
  notes?: string;
}
