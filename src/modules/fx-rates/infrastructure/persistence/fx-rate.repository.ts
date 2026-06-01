import { FxRate, FxCurrency } from '../../domain/fx-rate';
import { NullableType } from '@/common/utils/types/nullable.type';

export abstract class FxRateRepository {
  abstract upsert(data: Omit<FxRate, 'createdAt' | 'updatedAt'>): Promise<FxRate>;

  abstract findLatest(currency: FxCurrency): Promise<NullableType<FxRate>>;

  abstract findByCurrencyAndDate(currency: FxCurrency, effectiveDate: string): Promise<NullableType<FxRate>>;

  abstract findHistory(currency: FxCurrency, from: string, to: string): Promise<FxRate[]>;
}
