import { FxCurrency } from '../domain/fx-rate';
import { FxSourceCode } from '../config/fx-config.type';

export type FxSourceResult = {
  currency: FxCurrency;
  rate: string;
  source: FxSourceCode;
  effectiveDate: string;
  fetchedAt: Date;
};

export abstract class FxSourcePort {
  abstract readonly code: FxSourceCode;
  abstract fetch(currency: FxCurrency): Promise<FxSourceResult>;
}
