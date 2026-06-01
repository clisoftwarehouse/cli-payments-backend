import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({
    type: String,
    example: 'userId',
  })
  @IsNotEmpty()
  id: string | number;
}
