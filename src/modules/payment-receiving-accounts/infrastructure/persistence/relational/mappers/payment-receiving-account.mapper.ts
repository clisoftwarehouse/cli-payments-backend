import { PaymentReceivingAccount } from '../../../../domain/payment-receiving-account';
import { PaymentReceivingAccountEntity } from '../entities/payment-receiving-account.entity';

export class PaymentReceivingAccountMapper {
  static toDomain(raw: PaymentReceivingAccountEntity): PaymentReceivingAccount {
    const domain = new PaymentReceivingAccount();
    domain.id = raw.id;
    domain.applicationId = raw.applicationId;
    domain.methodKind = raw.methodKind as 'transfer' | 'pago_movil';
    domain.bankCode = raw.bankCode;
    domain.bankName = raw.bankName;
    domain.accountHolder = raw.accountHolder;
    domain.identityDocument = raw.identityDocument;
    domain.accountNumber = raw.accountNumber;
    domain.accountType = raw.accountType;
    domain.phone = raw.phone;
    domain.isActive = raw.isActive;
    domain.createdAt = raw.createdAt;
    domain.updatedAt = raw.updatedAt;
    return domain;
  }

  static toPersistence(domain: Partial<PaymentReceivingAccount>): Partial<PaymentReceivingAccountEntity> {
    const entity = new PaymentReceivingAccountEntity();
    if (domain.id !== undefined) entity.id = domain.id;
    if (domain.applicationId !== undefined) entity.applicationId = domain.applicationId;
    if (domain.methodKind !== undefined) entity.methodKind = domain.methodKind;
    if (domain.bankCode !== undefined) entity.bankCode = domain.bankCode;
    if (domain.bankName !== undefined) entity.bankName = domain.bankName;
    if (domain.accountHolder !== undefined) entity.accountHolder = domain.accountHolder;
    if (domain.identityDocument !== undefined) entity.identityDocument = domain.identityDocument;
    if (domain.accountNumber !== undefined) entity.accountNumber = domain.accountNumber;
    if (domain.accountType !== undefined) entity.accountType = domain.accountType;
    if (domain.phone !== undefined) entity.phone = domain.phone;
    if (domain.isActive !== undefined) entity.isActive = domain.isActive;
    return entity;
  }
}
