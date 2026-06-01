import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StatusDto {
  @ApiProperty()
  @IsNumber()
  id: number | string;
}
