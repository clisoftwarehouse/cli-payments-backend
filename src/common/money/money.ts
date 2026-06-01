import Decimal from 'decimal.js';

/**
 * Monedas soportadas en el dominio. La presentación al cliente puede ser EUR/USD;
 * el cobro en VES se materializa al snapshotear el FX (ver `MoneyConverter`).
 */
export type Currency = 'EUR' | 'USD' | 'VES';

const SCALE_BY_CURRENCY: Record<Currency, number> = {
  EUR: 2,
  USD: 2,
  VES: 2,
};

/**
 * Value object inmutable para cantidades monetarias.
 *
 * Razones de ser:
 * - Garantiza precisión decimal (decimal.js, no IEEE 754).
 * - Encapsula la moneda — operar `Money(EUR, 15) + Money(VES, 3000)` falla
 *   en compile + runtime, no silenciosamente.
 * - Centraliza scale por moneda (2 decimales para EUR/USD/VES; otras se
 *   agregan en `SCALE_BY_CURRENCY`).
 * - Reemplaza string-typed amounts diseminados por el codebase que mezclan
 *   formatos y precision.
 *
 * Convenciones:
 * - Inmutable: cada operación devuelve un nuevo `Money`.
 * - Construcción rechaza valores con más decimales que el scale permitido.
 * - Para hablar con SQL/Sitef/JSON: `.toFixed()` (string con scale exacto).
 * - Para multiplicar por FX: el resultado puede cambiar de moneda → usa
 *   `MoneyConverter` que lo modela explícito.
 */
export class Money {
  private readonly value: Decimal;
  public readonly currency: Currency;

  private constructor(value: Decimal, currency: Currency) {
    this.value = value;
    this.currency = currency;
  }

  // ── Factories ──

  static of(amount: Decimal.Value, currency: Currency): Money {
    const decimal = new Decimal(amount);
    const scale = SCALE_BY_CURRENCY[currency];
    if (decimal.decimalPlaces() > scale) {
      throw new MoneyError(
        `Money(${currency}) acepta hasta ${scale} decimales — recibido ${decimal.toString()}`,
      );
    }
    if (!decimal.isFinite()) {
      throw new MoneyError(`Money(${currency}) debe ser finito — recibido ${decimal.toString()}`);
    }
    return new Money(decimal, currency);
  }

  static parse(amount: string, currency: Currency): Money {
    const trimmed = amount.trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      throw new MoneyError(`Money.parse: formato inválido "${amount}"`);
    }
    return Money.of(trimmed, currency);
  }

  static zero(currency: Currency): Money {
    return new Money(new Decimal(0), currency);
  }

  // ── Inspección ──

  get amount(): Decimal {
    // Decimal es inmutable, así que devolver la referencia es seguro.
    return this.value;
  }

  get scale(): number {
    return SCALE_BY_CURRENCY[this.currency];
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.gt(0);
  }

  isNegative(): boolean {
    return this.value.lt(0);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.value.eq(other.value);
  }

  /** Igual ignorando precision (uses Decimal.eq with auto rounding). */
  closeTo(other: Money, epsilon: Decimal.Value = new Decimal(10).pow(-this.scale)): boolean {
    if (this.currency !== other.currency) return false;
    return this.value.minus(other.value).abs().lte(epsilon);
  }

  // ── Operaciones aritméticas ──

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.plus(other.value), this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.value.minus(other.value), this.currency);
  }

  times(factor: Decimal.Value): Money {
    const result = this.value.times(factor);
    return Money.of(result.toDecimalPlaces(this.scale, Decimal.ROUND_HALF_EVEN), this.currency);
  }

  /** Aplica FX y devuelve un Money en la nueva moneda. */
  convertTo(target: Currency, rate: Decimal.Value): Money {
    const decimal = new Decimal(rate);
    if (decimal.lte(0)) throw new MoneyError(`FX rate debe ser > 0, recibido ${decimal.toString()}`);
    const targetScale = SCALE_BY_CURRENCY[target];
    const result = this.value.times(decimal).toDecimalPlaces(targetScale, Decimal.ROUND_HALF_EVEN);
    return Money.of(result, target);
  }

  // ── Salida ──

  /**
   * String exacto con scale por moneda. Es lo que persistes en DB (`numeric(12,2)`)
   * y lo que mandas en JSON.
   */
  toFixed(): string {
    return this.value.toFixed(this.scale);
  }

  /** Número primitivo. ⚠️ Pierde precisión — solo para Sitef u otros endpoints que exigen number. */
  toNumber(): number {
    return this.value.toNumber();
  }

  /** Formato humano localizado (display). NO usar para persistencia ni para Sitef. */
  toDisplay(locale = 'es-VE'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: this.scale,
      maximumFractionDigits: this.scale,
    }).format(this.toNumber());
  }

  toString(): string {
    return `${this.toFixed()} ${this.currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new MoneyError(`Mismatch de moneda: ${this.currency} vs ${other.currency}`);
    }
  }
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}
