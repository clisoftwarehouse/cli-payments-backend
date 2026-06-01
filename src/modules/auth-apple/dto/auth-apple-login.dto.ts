import { Allow, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthAppleLoginDto {
  @ApiProperty({ example: 'abc' })
  @IsNotEmpty()
  idToken: string;

  @Allow()
  @ApiPropertyOptional()
  firstName?: string;

  @Allow()
  @ApiPropertyOptional()
  lastName?: string;
}
