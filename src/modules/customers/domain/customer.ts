import { ApiProperty } from '@nestjs/swagger';

export type IdentityType = 'rif' | 'cedula' | 'passport' | 'nif' | 'other';

export class Customer {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ required: false, nullable: true })
  phone: string | null;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2', example: 'VE' })
  country: string;

  @ApiProperty({ enum: ['rif', 'cedula', 'passport', 'nif', 'other'], required: false, nullable: true })
  identityType: IdentityType | null;

  @ApiProperty({ required: false, nullable: true })
  identityValue: string | null;

  @ApiProperty({ required: false, nullable: true })
  legalName: string | null;

  @ApiProperty({ required: false, nullable: true })
  address: string | null;

  @ApiProperty({ default: 'es' })
  defaultLocale: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
