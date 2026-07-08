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
   * Transición idempotente y atómica a `paid` (compare-and-swap a nivel DB).
   *
   * El UPDATE condicional `status <> 'paid'` serializa la concurrencia: ante dos
   * llamadas simultáneas, el row-lock de Postgres deja que solo una afecte la fila
   * (`transitioned=true`); la otra, al reevaluar el WHERE sobre la fila ya en `paid`,
   * afecta 0 filas → `transitioned=false`. El caller usa ese flag para NO duplicar
   * efectos secundarios (webhook `invoice.paid`, avance de la suscripción).
   *
   * Debe invocarse dentro de una transacción (`em`) para que el append al outbox que
   * hace el caller comparta atomicidad con la transición.
   */
  async markPaid(id: string, em: EntityManager): Promise<{ invoice: Invoice; transitioned: boolean }> {
    const repo = em.getRepository(InvoiceEntity);
    const res = await repo
      .createQueryBuilder()
      .update(InvoiceEntity)
      .set({ status: 'paid', paidAt: new Date() })
      .where('id = :id', { id })
      .andWhere('status <> :paidStatus', { paidStatus: 'paid' })
      .execute();
    const transitioned = (res.affected ?? 0) > 0;

    const entity = await repo.findOne({ where: { id }, relations: ['items'] });
    if (!entity) throw new NotFoundException('Invoice not found');
    return { invoice: InvoiceMapper.toDomain(entity), transitioned };
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
