import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsInt, IsUUID, IsString, MaxLength, IsOptional } from 'class-validator';

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

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
