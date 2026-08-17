import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsIn, IsInt, IsUUID, IsArray, IsString, MaxLength, IsOptional } from 'class-validator';

/** Métodos ruteable por terminal. Zelle no aplica (nunca llega al gateway Sitef). */
export const TERMINAL_METHOD_KINDS = ['c2p', 'pago_movil', 'transfer', 'card', 'card_ccr', 'web_button'] as const;
export type TerminalMethodKind = (typeof TERMINAL_METHOD_KINDS)[number];

export class CreateMerchantTerminalDto {
  @ApiProperty()
  @IsUUID()
  applicationId: string;

  @ApiProperty({ example: 'Caja Principal' })
  @IsString()
  @MaxLength(120)
  label: string;

  @ApiProperty({ example: 'sitef_xxxx' })
  @IsString()
  @MaxLength(120)
  sitefUsername: string;

  @ApiProperty({ description: 'Password en claro — se encripta AES-256-GCM antes de persistir.' })
  @IsString()
  sitefPassword: string;

  @ApiProperty({ example: 117 })
  @IsInt()
  @Min(0)
  sitefIdBranch: number;

  @ApiProperty({ example: '008' })
  @IsString()
  @MaxLength(16)
  sitefCodeStall: string;

  @ApiProperty({ example: 105, description: 'Banco adquiriente (issuingbank/receivingbank). Ej: 105 Mercantil.' })
  @IsInt()
  @Min(0)
  acquirerBank: number;

  @ApiPropertyOptional({
    isArray: true,
    enum: TERMINAL_METHOD_KINDS,
    description:
      'Métodos que atiende este terminal. Omitir/vacío = terminal por defecto (todo método sin terminal específico).',
  })
  @IsArray()
  @IsIn(TERMINAL_METHOD_KINDS, { each: true })
  @IsOptional()
  methodKinds?: TerminalMethodKind[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
