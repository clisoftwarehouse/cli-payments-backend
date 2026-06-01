import { PaymentReceivingAccount } from '../../domain/payment-receiving-account';
import { CreatePaymentReceivingAccountDto } from '../../dto/create-payment-receiving-account.dto';
import { UpdatePaymentReceivingAccountDto } from '../../dto/update-payment-receiving-account.dto';

export abstract class PaymentReceivingAccountRepository {
  abstract findByApplication(applicationId: string, methodKind?: string): Promise<PaymentReceivingAccount[]>;
  abstract findActiveByApplication(applicationId: string, methodKind?: string): Promise<PaymentReceivingAccount[]>;
  abstract findById(id: string): Promise<PaymentReceivingAccount | null>;
  abstract create(dto: CreatePaymentReceivingAccountDto): Promise<PaymentReceivingAccount>;
  abstract update(id: string, dto: UpdatePaymentReceivingAccountDto): Promise<PaymentReceivingAccount>;
  abstract remove(id: string): Promise<void>;
}
