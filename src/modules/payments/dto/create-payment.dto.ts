import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsString, MaxLength } from 'class-validator';

import { PaymentMethodKind } from '../domain/payment';

export class CreatePaymentBodyDto {
  @ApiProperty({ enum: ['c2p', 'transfer', 'pago_movil', 'web_button', 'card_ccr'] })
  @IsIn(['c2p', 'transfer', 'pago_movil', 'web_button', 'card_ccr'])
  method: PaymentMethodKind;

  @ApiProperty({
    description:
      'Datos del método. ' +
      'C2P: { destinationId, destinationMobileNumber, destinationBank }. ' +
      'Transfer: { originBank, originDni, paymentReference, trxDate }. ' +
      'Pago Móvil P2P: { originBank, debitPhone, paymentReference, trxDate }. ' +
      'Web button: { clientName, returnUrl, receivingBank? }. ' +
      'Card CCR: { cardNumber, tipoDocumento, documentoCliente, cvc, monthExp, yearExp, cardHolderName }.',
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
