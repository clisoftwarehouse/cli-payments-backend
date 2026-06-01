import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { PaymentReceivingAccount } from '../../../../domain/payment-receiving-account';
import { PaymentReceivingAccountMapper } from '../mappers/payment-receiving-account.mapper';
import { PaymentReceivingAccountEntity } from '../entities/payment-receiving-account.entity';
import { PaymentReceivingAccountRepository } from '../../payment-receiving-account.repository';
import { CreatePaymentReceivingAccountDto } from '../../../../dto/create-payment-receiving-account.dto';
import { UpdatePaymentReceivingAccountDto } from '../../../../dto/update-payment-receiving-account.dto';

@Injectable()
export class PaymentReceivingAccountsRelationalRepository extends PaymentReceivingAccountRepository {
  constructor(
    @InjectRepository(PaymentReceivingAccountEntity)
    private readonly repository: Repository<PaymentReceivingAccountEntity>,
  ) {
    super();
  }

  async findByApplication(applicationId: string, methodKind?: string): Promise<PaymentReceivingAccount[]> {
    const where: Record<string, unknown> = { applicationId };
    if (methodKind) where.methodKind = methodKind;
    const entities = await this.repository.find({ where, order: { createdAt: 'ASC' } });
    return entities.map((e) => PaymentReceivingAccountMapper.toDomain(e));
  }

  async findActiveByApplication(applicationId: string, methodKind?: string): Promise<PaymentReceivingAccount[]> {
    const where: Record<string, unknown> = { applicationId, isActive: true };
    if (methodKind) where.methodKind = methodKind;
    const entities = await this.repository.find({ where, order: { createdAt: 'ASC' } });
    return entities.map((e) => PaymentReceivingAccountMapper.toDomain(e));
  }

  async findById(id: string): Promise<PaymentReceivingAccount | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? PaymentReceivingAccountMapper.toDomain(entity) : null;
  }

  async create(dto: CreatePaymentReceivingAccountDto): Promise<PaymentReceivingAccount> {
    const entity = this.repository.create({
      applicationId: dto.applicationId,
      methodKind: dto.methodKind,
      bankCode: dto.bankCode,
      bankName: dto.bankName,
      accountHolder: dto.accountHolder,
      identityDocument: dto.identityDocument,
      accountNumber: dto.accountNumber ?? null,
      accountType: dto.accountType ?? null,
      phone: dto.phone ?? null,
      isActive: true,
    });
    const saved = await this.repository.save(entity);
    return PaymentReceivingAccountMapper.toDomain(saved);
  }

  async update(id: string, dto: UpdatePaymentReceivingAccountDto): Promise<PaymentReceivingAccount> {
    const updates: Partial<PaymentReceivingAccountEntity> = {};
    if (dto.bankCode !== undefined) updates.bankCode = dto.bankCode;
    if (dto.bankName !== undefined) updates.bankName = dto.bankName;
    if (dto.accountHolder !== undefined) updates.accountHolder = dto.accountHolder;
    if (dto.identityDocument !== undefined) updates.identityDocument = dto.identityDocument;
    if (dto.accountNumber !== undefined) updates.accountNumber = dto.accountNumber;
    if (dto.accountType !== undefined) updates.accountType = dto.accountType;
    if (dto.phone !== undefined) updates.phone = dto.phone;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;
    await this.repository.update(id, updates);
    const updated = await this.repository.findOneOrFail({ where: { id } });
    return PaymentReceivingAccountMapper.toDomain(updated);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
