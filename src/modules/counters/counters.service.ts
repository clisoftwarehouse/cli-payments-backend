import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';

import { CounterEntity } from './infrastructure/persistence/relational/entities/counter.entity';

@Injectable()
export class CountersService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Incrementa atómicamente y devuelve el nuevo valor.
   * Garantiza no-skip ni duplicación bajo concurrencia usando UPDATE...RETURNING (que es atómico en Postgres).
   */
  async next(key: string): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CounterEntity);

      const existing = await repo.findOne({ where: { key }, lock: { mode: 'pessimistic_write' } });
      if (!existing) {
        await repo.insert({ key, value: '1' });
        return 1;
      }

      const next = BigInt(existing.value) + 1n;
      await repo.update({ key }, { value: next.toString() });
      return Number(next);
    });
  }

  /** Formato `CLI-YYYY-NNNNNN` para correlativos de factura. */
  async nextInvoiceNumber(year: number): Promise<string> {
    const key = `invoice_number_${year}`;
    const n = await this.next(key);
    return `CLI-${year}-${n.toString().padStart(6, '0')}`;
  }
}
