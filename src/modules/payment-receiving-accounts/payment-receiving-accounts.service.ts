import { Injectable, NotFoundException } from '@nestjs/common';

import { PaymentReceivingAccount } from './domain/payment-receiving-account';
import { PaymentReceivingAccountRepository } from './infrastructure/persistence/payment-receiving-account.repository';
import { CreatePaymentReceivingAccountDto } from './dto/create-payment-receiving-account.dto';
import { UpdatePaymentReceivingAccountDto } from './dto/update-payment-receiving-account.dto';

@Injectable()
export class PaymentReceivingAccountsService {
  constructor(private readonly repository: PaymentReceivingAccountRepository) {}

  listByApplication(applicationId: string, methodKind?: string): Promise<PaymentReceivingAccount[]> {
    return this.repository.findByApplication(applicationId, methodKind);
  }

  listActiveByApplication(applicationId: string, methodKind?: string): Promise<PaymentReceivingAccount[]> {
    return this.repository.findActiveByApplication(applicationId, methodKind);
  }

  async findById(id: string): Promise<PaymentReceivingAccount> {
    const account = await this.repository.findById(id);
    if (!account) {
      throw new NotFoundException(`PaymentReceivingAccount con id "${id}" no encontrada.`);
    }
    return account;
  }

  create(dto: CreatePaymentReceivingAccountDto): Promise<PaymentReceivingAccount> {
    return this.repository.create(dto);
  }

  async update(id: string, dto: UpdatePaymentReceivingAccountDto): Promise<PaymentReceivingAccount> {
    await this.findById(id);
    return this.repository.update(id, dto);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    return this.repository.remove(id);
  }
}
