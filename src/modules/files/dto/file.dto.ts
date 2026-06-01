import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class FileDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  path: string;
}
