import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentReceivingAccount {
  @ApiProperty() id: string;
  @ApiProperty() applicationId: string;
  @ApiProperty({ enum: ['transfer', 'pago_movil'] }) methodKind: 'transfer' | 'pago_movil';
  @ApiProperty() bankCode: number;
  @ApiProperty() bankName: string;
  @ApiProperty() accountHolder: string;
  @ApiProperty() identityDocument: string;
  @ApiPropertyOptional({ nullable: true }) accountNumber: string | null;
  @ApiPropertyOptional({ nullable: true, enum: ['corriente', 'ahorro'] }) accountType: string | null;
  @ApiPropertyOptional({ nullable: true }) phone: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
