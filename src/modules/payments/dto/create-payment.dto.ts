import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsString, MaxLength } from 'class-validator';

import { PaymentMethodKind } from '@/modules/gateways/sitef/payment-gateway.port';

export class CreatePaymentBodyDto {
  @ApiProperty({ enum: ['c2p', 'transfer', 'pago_movil', 'web_button', 'card_ccr', 'card'] })
  @IsIn(['c2p', 'transfer', 'pago_movil', 'web_button', 'card_ccr', 'card'])
  method: PaymentMethodKind;

  @ApiProperty({
    description:
      'Datos del método. ' +
      'C2P: { destinationId, destinationMobileNumber, destinationBank }. ' +
      'Transfer: { originBank, originDni, paymentReference, trxDate }. ' +
      'Pago Móvil P2P: { originBank, debitPhone, paymentReference, trxDate }. ' +
      'Web button: { clientName, returnUrl, receivingBank? }. ' +
      'Card CCR: { cardNumber, tipoDocumento, documentoCliente, cvc, monthExp, yearExp, cardHolderName }. ' +
      'Card (Mercantil): { cardType: "credit"|"debit", cardNumber, expirationDate: "YYYY/MM", cvv, customerId, accountType?: "CC"|"CA" }.',
  })
  @IsObject()
  methodData: Record<string, unknown>;

  @ApiProperty({
    example: 'a4b2c5e7-...',
    description: 'UUID o string único provisto por el cliente. Header Idempotency-Key.',
  })
  @IsString()
  @MaxLength(80)
  idempotencyKey: string;
}
