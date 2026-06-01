import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, Length, IsEmail, IsString, MaxLength, IsOptional } from 'class-validator';

import { IdentityType } from '../domain/customer';

export class UpsertCustomerDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MaxLength(240)
  fullName: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(40)
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ default: 'VE' })
  @IsString()
  @Length(2, 2)
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ enum: ['rif', 'cedula', 'passport', 'nif', 'other'] })
  @IsIn(['rif', 'cedula', 'passport', 'nif', 'other'])
  @IsOptional()
  identityType?: IdentityType;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(60)
  @IsOptional()
  identityValue?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(240)
  @IsOptional()
  legalName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ default: 'es' })
  @IsString()
  @MaxLength(8)
  @IsOptional()
  defaultLocale?: string;
}
