import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MerchantTerminal {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty({ example: 'Caja Principal' })
  label: string;

  @ApiProperty({ example: 'sitef_xxxx' })
  sitefUsername: string;

  @ApiProperty({ description: 'Id de la sede en Sitef.' })
  sitefIdBranch: number;

  @ApiProperty({ description: 'Código de la caja en Sitef.' })
  sitefCodeStall: string;

  @ApiProperty({ description: 'Banco adquiriente (issuingbank/receivingbank en Sitef). Ej: 105 Mercantil.' })
  acquirerBank: number;

  @ApiPropertyOptional({
    nullable: true,
    isArray: true,
    type: String,
    description:
      'Métodos que atiende este terminal (c2p, pago_movil, transfer, card, card_ccr, web_button). ' +
      'Vacío/null = terminal por defecto: atiende todo método sin terminal específico.',
  })
  methodKinds: string[] | null;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export type MerchantTerminalWithSecret = MerchantTerminal & { sitefPassword: string };
