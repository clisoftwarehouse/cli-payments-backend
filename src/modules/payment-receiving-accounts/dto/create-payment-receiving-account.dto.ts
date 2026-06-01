import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, MaxLength, IsOptional, IsUUID, Min } from 'class-validator';

export class CreatePaymentReceivingAccountDto {
  @ApiProperty() @IsUUID() applicationId: string;
  @ApiProperty({ enum: ['transfer', 'pago_movil'] }) @IsIn(['transfer', 'pago_movil']) methodKind: 'transfer' | 'pago_movil';
  @ApiProperty() @IsInt() @Min(1) bankCode: number;
  @ApiProperty() @IsString() @MaxLength(100) bankName: string;
  @ApiProperty() @IsString() @MaxLength(100) accountHolder: string;
  @ApiProperty() @IsString() @MaxLength(20) identityDocument: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) accountNumber?: string;
  @ApiPropertyOptional({ enum: ['corriente', 'ahorro'] }) @IsOptional() @IsIn(['corriente', 'ahorro']) accountType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phone?: string;
}
