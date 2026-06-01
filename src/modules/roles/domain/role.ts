import { Allow } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const idType = Number;

export class Role {
  @Allow()
  @ApiProperty({
    type: idType,
  })
  id: number | string;

  @Allow()
  @ApiProperty({
    type: String,
    example: 'admin',
  })
  name?: string;
}
