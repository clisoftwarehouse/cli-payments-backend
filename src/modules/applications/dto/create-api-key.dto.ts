import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Production' })
  @IsString()
  @MaxLength(120)
  label: string;

  @ApiProperty({
    type: [String],
    example: ['payments:create', 'subscriptions:write', 'fx:read', 'customers:write'],
  })
  @IsArray()
  @IsString({ each: true })
  scopes: string[];
}
