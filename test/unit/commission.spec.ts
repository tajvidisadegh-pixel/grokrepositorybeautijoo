import {
  calculateCommission,
  DEFAULT_PLATFORM_COMMISSION_RATE,
} from '../../src/payments/financial.util';

describe('calculateCommission', () => {
  it('uses default-like 10% on clean amounts', () => {
    const r = calculateCommission(100_000, DEFAULT_PLATFORM_COMMISSION_RATE);
    expect(r.commissionRate).toBe(10);
    expect(r.commissionAmount).toBe(10_000);
    expect(r.professionalNetAmount).toBe(90_000);
  });

  it('rounds half-up to nearest toman (Math.round)', () => {
    // 1000 * 10.5% = 105 → exact
    expect(calculateCommission(1000, 10.5).commissionAmount).toBe(105);
    // 333 * 10% = 33.3 → 33
    expect(calculateCommission(333, 10).commissionAmount).toBe(33);
    // 335 * 10% = 33.5 → 34
    expect(calculateCommission(335, 10).commissionAmount).toBe(34);
  });

  it('net + commission always equals gross', () => {
    for (const gross of [0, 1, 999, 50_000, 1_000_000]) {
      for (const rate of [0, 5, 10, 15.5, 100]) {
        const r = calculateCommission(gross, rate);
        expect(r.commissionAmount + r.professionalNetAmount).toBe(gross);
      }
    }
  });

  it('clamps rate to [0, 100]', () => {
    expect(calculateCommission(10_000, -5).commissionRate).toBe(0);
    expect(calculateCommission(10_000, -5).commissionAmount).toBe(0);
    expect(calculateCommission(10_000, 150).commissionRate).toBe(100);
    expect(calculateCommission(10_000, 150).commissionAmount).toBe(10_000);
    expect(calculateCommission(10_000, 150).professionalNetAmount).toBe(0);
  });

  it('zero gross yields zero commission', () => {
    const r = calculateCommission(0, 10);
    expect(r.commissionAmount).toBe(0);
    expect(r.professionalNetAmount).toBe(0);
  });
});
