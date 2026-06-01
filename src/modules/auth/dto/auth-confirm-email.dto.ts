import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthConfirmEmailDto {
  @ApiProperty()
  @IsNotEmpty()
  hash: string;
}
