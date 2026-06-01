import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsUrl, IsEmail, Matches, IsString, MaxLength, IsOptional } from 'class-validator';

import { ApplicationMode } from '../domain/application';

export class CreateApplicationDto {
  @ApiProperty({ example: 'vitriona' })
  @Matches(/^[a-z0-9](-?[a-z0-9])+$/, {
    message: 'slug debe ser lowercase con guiones, sin acentos ni espacios',
  })
  @MaxLength(64)
  slug: string;

  @ApiProperty({ example: 'Vitriona' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ enum: ['live', 'test'], default: 'live' })
  @IsIn(['live', 'test'])
  @IsOptional()
  mode?: ApplicationMode = 'live';

  @ApiPropertyOptional()
  @IsUrl({ require_tld: false })
  @IsOptional()
  websiteUrl?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  contactEmail?: string;
}
