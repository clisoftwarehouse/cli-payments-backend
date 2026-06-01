import { ApiProperty } from '@nestjs/swagger';
import { Length, IsString } from 'class-validator';

export class SubmitOtpDto {
  @ApiProperty()
  @IsString()
  @Length(4, 16)
  otp: string;
}
