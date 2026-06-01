import Decimal from 'decimal.js';
import { EntityManager } from 'typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { Invoice } from './domain/invoice';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CheckoutTokenService } from './checkout-token.service';
import { FxRatesService } from '@/modules/fx-rates/fx-rates.service';
import { CountersService } from '@/modules/counters/counters.service';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';
import { InvoiceMapper } from './infrastructure/persistence/relational/mappers/invoice.mapper';
import { InvoiceEntity } from './infrastructure/persistence/relational/entities/invoice.entity';
import { InvoiceRepository } from './infrastructure/persistence/invoice.repository';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly invoicesRepository: InvoiceRepository,
    private readonly counters: CountersService,
    private readonly fx: FxRatesService,
    private readonly checkoutTokens: CheckoutTokenService,
  ) {}

  async createDraft(dto: CreateInvoiceDto): Promise<Invoice> {
    const items = dto.items.map((i) => {
      const unit = new Decimal(i.unitAmountEur);
      if (unit.lte(0)) throw new BadRequestException(`unitAmountEur debe ser > 0 en item "${i.description}"`);
      return {
        productId: i.productId,
        description: i.description,
        quantity: i.quantity,
        unitAmountEur: unit.toFixed(2),
        lineTotalEur: unit.mul(i.quantity).toFixed(2),
        metadata: i.metadata,
      };
    });

    const total = items.reduce((acc, it) => acc.plus(new Decimal(it.lineTotalEur)), new Decimal(0));

    return this.invoicesRepository.createDraft({
      applicationId: dto.applicationId,
      customerId: dto.customerId,
      displayCurrency: dto.displayCurrency ?? 'EUR',
      displayAmount: total.toFixed(2),
      dueDate: dto.dueDate ?? null,
      notes: dto.notes ?? null,
      items,
    });
  }

  /**
   * Mueve `draft → open`. Asigna número correlativo + checkout token firmado + snapshot FX.
   * Si la factura ya está `open` o `paid`, no se reemite.
   */
  async issue(id: string): Promise<Invoice> {
    const invoice = await this.findById(id);
    if (invoice.status !== 'draft') {
      throw new BadRequestException(`Solo se pueden emitir facturas en estado draft. Estado actual: ${invoice.status}`);
    }

    const currency = invoice.displayCurrency;
    const fxSnapshot = currency === 'EUR' || currency === 'USD' ? await this.fx.getLatestSafe(currency) : null;

    let chargedCurrency: string | null = null;
    let chargedAmount: string | null = null;
    if (fxSnapshot) {
      chargedCurrency = 'VES';
      chargedAmount = new Decimal(invoice.displayAmount).mul(new Decimal(fxSnapshot.rate)).toFixed(2);
    }

    const year = new Date().getFullYear();
    const number = await this.counters.nextInvoiceNumber(year);
    const { token, expiresAt } = this.checkoutTokens.sign(invoice.id);

    return this.invoicesRepository.update(invoice.id, {
      status: 'open',
      number,
      fxRateSource: fxSnapshot?.source,
      fxRateUsed: fxSnapshot?.rate,
      fxRateDate: fxSnapshot?.effectiveDate,
      chargedCurrency: chargedCurrency ?? undefined,
      chargedAmount: chargedAmount ?? undefined,
      checkoutToken: token,
      checkoutTokenExpiresAt: expiresAt,
    });
  }

  /**
   * Marca invoice como `paid`. Si `em` se provee, usa ese EntityManager (para
   * meter el update dentro de una transacción del caller — patrón outbox).
   * Sin `em`, transacción implícita del repository.
   */
  async markPaid(id: string, em?: EntityManager): Promise<Invoice> {
    if (!em) {
      return this.invoicesRepository.update(id, { status: 'paid', paidAt: new Date() });
    }
    const repo = em.getRepository(InvoiceEntity);
    const entity = await repo.findOne({ where: { id }, relations: ['items'] });
    if (!entity) throw new NotFoundException('Invoice not found');
    entity.status = 'paid';
    entity.paidAt = new Date();
    // repo.save() no garantiza devolver relaciones — usar `entity` que ya las tiene cargadas.
    await repo.save(entity);
    return InvoiceMapper.toDomain(entity);
  }

  async findById(id: string): Promise<Invoice> {
    const i = await this.invoicesRepository.findById(id);
    if (!i) throw new NotFoundException('Invoice not found');
    return i;
  }

  async findByCheckoutToken(token: string): Promise<Invoice> {
    this.checkoutTokens.verify(token);
    const invoice = await this.invoicesRepository.findByCheckoutToken(token);
    if (!invoice) throw new NotFoundException('Invoice not found for token');
    return invoice;
  }

  list(opts: IPaginationOptions & { applicationId?: string; customerId?: string; status?: string }) {
    return this.invoicesRepository.findMany(opts);
  }
}
