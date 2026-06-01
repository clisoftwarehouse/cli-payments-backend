import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { Invoice } from '../../../../domain/invoice';
import { InvoiceMapper } from '../mappers/invoice.mapper';
import { InvoiceEntity } from '../entities/invoice.entity';
import { NullableType } from '@/common/utils/types/nullable.type';
import { InvoiceItemEntity } from '../entities/invoice-item.entity';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';
import { InvoiceRepository, InvoiceCreateInput, InvoiceUpdateInput } from '../../invoice.repository';

@Injectable()
export class InvoicesRelationalRepository implements InvoiceRepository {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly repo: Repository<InvoiceEntity>,
  ) {}

  async createDraft(data: InvoiceCreateInput): Promise<Invoice> {
    const items = data.items.map((i) => {
      const e = new InvoiceItemEntity();
      e.productId = i.productId ?? null;
      e.description = i.description;
      e.quantity = i.quantity;
      e.unitAmountEur = i.unitAmountEur;
      e.lineTotalEur = i.lineTotalEur;
      e.metadata = i.metadata ?? null;
      return e;
    });

    const entity = this.repo.create({
      applicationId: data.applicationId,
      customerId: data.customerId,
      status: 'draft',
      displayCurrency: data.displayCurrency,
      displayAmount: data.displayAmount,
      dueDate: data.dueDate ?? null,
      notes: data.notes ?? null,
      items,
    });

    const saved = await this.repo.save(entity);
    return InvoiceMapper.toDomain(saved);
  }

  async update(id: string, payload: InvoiceUpdateInput): Promise<Invoice> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Invoice not found');
    Object.assign(entity, payload);
    const saved = await this.repo.save(entity);
    return InvoiceMapper.toDomain(saved);
  }

  async findById(id: string): Promise<NullableType<Invoice>> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? InvoiceMapper.toDomain(entity) : null;
  }

  async findByCheckoutToken(token: string): Promise<NullableType<Invoice>> {
    const entity = await this.repo.findOne({ where: { checkoutToken: token } });
    return entity ? InvoiceMapper.toDomain(entity) : null;
  }

  async findMany(opts: IPaginationOptions & { applicationId?: string; customerId?: string; status?: string }): Promise<Invoice[]> {
    const where: Record<string, unknown> = {};
    if (opts.applicationId) where.applicationId = opts.applicationId;
    if (opts.customerId) where.customerId = opts.customerId;
    if (opts.status) where.status = opts.status;

    const entities = await this.repo.find({
      where,
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      order: { createdAt: 'DESC' },
    });
    return entities.map(InvoiceMapper.toDomain);
  }
}
