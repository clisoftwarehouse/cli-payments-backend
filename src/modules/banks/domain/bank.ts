import { ApiProperty } from '@nestjs/swagger';

export class Bank {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '0102', description: 'Código IBP (Identificación Bancaria de Pago) del banco venezolano.' })
  ibpCode: string;

  @ApiProperty({ example: 'Banco de Venezuela' })
  name: string;

  @ApiProperty({ example: 'BDV' })
  shortName: string;

  @ApiProperty({ description: 'Soporta cobros C2P (Pago Móvil C2P).' })
  c2pEnabled: boolean;

  @ApiProperty({ description: 'Soporta transferencias inmediatas vía Sitef.' })
  transferEnabled: boolean;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
