import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, MaxLength, IsBoolean, IsOptional, Min } from 'class-validator';

export class UpdatePaymentReceivingAccountDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) bankCode?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) bankName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) accountHolder?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) identityDocument?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) accountNumber?: string;
  @ApiPropertyOptional({ enum: ['corriente', 'ahorro'] }) @IsOptional() @IsIn(['corriente', 'ahorro']) accountType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
