import Decimal from 'decimal.js';

import { Money, MoneyError } from './money';

describe('Money.of', () => {
  it('acepta números con scale ≤ moneda', () => {
    const m = Money.of(15, 'EUR');
    expect(m.toFixed()).toBe('15.00');
    expect(m.currency).toBe('EUR');
  });

  it('rechaza > 2 decimales para EUR', () => {
    expect(() => Money.of('15.123', 'EUR')).toThrow(MoneyError);
  });

  it('rechaza NaN/Infinity', () => {
    expect(() => Money.of(NaN, 'EUR')).toThrow(MoneyError);
    expect(() => Money.of(Infinity, 'EUR')).toThrow(MoneyError);
  });

  it('zero crea Money(0)', () => {
    const m = Money.zero('USD');
    expect(m.isZero()).toBe(true);
    expect(m.toFixed()).toBe('0.00');
  });
});

describe('Money.parse', () => {
  it('parsea string válido', () => {
    expect(Money.parse('15.00', 'EUR').toFixed()).toBe('15.00');
    expect(Money.parse('1500.50', 'VES').toFixed()).toBe('1500.50');
  });

  it('rechaza basura', () => {
    expect(() => Money.parse('abc', 'EUR')).toThrow(MoneyError);
    expect(() => Money.parse('', 'EUR')).toThrow(MoneyError);
    expect(() => Money.parse('15 EUR', 'EUR')).toThrow(MoneyError);
  });

  it('trims whitespace', () => {
    expect(Money.parse('  15.00  ', 'EUR').toFixed()).toBe('15.00');
  });
});

describe('Money aritmética', () => {
  it('plus mantiene precisión', () => {
    const sum = Money.of('0.10', 'EUR').plus(Money.of('0.20', 'EUR'));
    expect(sum.toFixed()).toBe('0.30'); // ¡0.1 + 0.2 = 0.3, no 0.30000000004!
  });

  it('plus rechaza monedas distintas', () => {
    expect(() => Money.of(15, 'EUR').plus(Money.of(100, 'USD'))).toThrow(MoneyError);
  });

  it('minus rechaza monedas distintas', () => {
    expect(() => Money.of(15, 'EUR').minus(Money.of(100, 'USD'))).toThrow(MoneyError);
  });

  it('times redondea HALF_EVEN al scale de la moneda', () => {
    // 1.115 * 1 con HALF_EVEN → 1.12 (banker's rounding)
    expect(Money.of('1.11', 'EUR').times('1.005').toFixed()).toBe('1.12');
  });

  it('Money es inmutable', () => {
    const a = Money.of('10.00', 'EUR');
    const b = a.plus(Money.of('5.00', 'EUR'));
    expect(a.toFixed()).toBe('10.00');
    expect(b.toFixed()).toBe('15.00');
  });
});

describe('Money.convertTo', () => {
  it('convierte EUR a VES con FX rate', () => {
    const eur = Money.of('15.00', 'EUR');
    const ves = eur.convertTo('VES', '60.50');
    expect(ves.currency).toBe('VES');
    expect(ves.toFixed()).toBe('907.50');
  });

  it('rechaza rate <= 0', () => {
    expect(() => Money.of(1, 'EUR').convertTo('VES', 0)).toThrow(MoneyError);
    expect(() => Money.of(1, 'EUR').convertTo('VES', -1)).toThrow(MoneyError);
  });

  it('aplica HALF_EVEN al scale de la moneda destino', () => {
    // 0.01 EUR * 602.1877 = 6.021877 → 6.02 VES (HALF_EVEN)
    const result = Money.of('0.01', 'EUR').convertTo('VES', '602.1877');
    expect(result.toFixed()).toBe('6.02');
  });
});

describe('Money.equals / closeTo', () => {
  it('equals: misma moneda + valor', () => {
    expect(Money.of('15', 'EUR').equals(Money.of('15.00', 'EUR'))).toBe(true);
    expect(Money.of('15', 'EUR').equals(Money.of('15', 'USD'))).toBe(false);
  });

  it('closeTo permite tolerancia', () => {
    expect(Money.of('15.00', 'EUR').closeTo(Money.of('15.01', 'EUR'))).toBe(true);
    expect(Money.of('15.00', 'EUR').closeTo(Money.of('15.05', 'EUR'))).toBe(false);
  });
});

describe('Money.toFixed / toNumber / toDisplay', () => {
  it('toFixed siempre con scale de la moneda', () => {
    expect(Money.of('15', 'EUR').toFixed()).toBe('15.00');
    expect(Money.of('15.5', 'EUR').toFixed()).toBe('15.50');
  });

  it('toNumber convierte a primitivo (con caveat de precisión)', () => {
    expect(Money.of('15.50', 'EUR').toNumber()).toBe(15.5);
  });

  it('toDisplay formatea por locale', () => {
    const eur = Money.of('1234.56', 'EUR');
    const display = eur.toDisplay('en-US');
    expect(display).toMatch(/€/);
    expect(display).toMatch(/1,234\.56/);
  });
});

describe('Money con Decimal directo (interop)', () => {
  it('acepta Decimal en factory', () => {
    const m = Money.of(new Decimal('15.50'), 'EUR');
    expect(m.toFixed()).toBe('15.50');
  });
});
