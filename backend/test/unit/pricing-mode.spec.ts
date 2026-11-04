import {
  assertModeAllowed,
  computeVariableTotals,
  normalizePricingMode,
  pickDefaultMode,
  resolveOptionDeltas,
  type CatalogPricingFlags,
} from '../../src/services/pricing-mode';

const allAllowed: CatalogPricingFlags = {
  allowFixed: true,
  allowVariable: true,
  allowDeposit: true,
  defaultPricingMode: 'fixed',
};

describe('pricing-mode (#80 regression)', () => {
  describe('normalizePricingMode', () => {
    it('defaults to fixed for empty/unknown', () => {
      expect(normalizePricingMode(null)).toBe('fixed');
      expect(normalizePricingMode(undefined)).toBe('fixed');
      expect(normalizePricingMode('')).toBe('fixed');
      expect(normalizePricingMode('weird')).toBe('fixed');
    });

    it('accepts fixed / variable / deposit', () => {
      expect(normalizePricingMode('fixed')).toBe('fixed');
      expect(normalizePricingMode('VARIABLE')).toBe('variable');
      expect(normalizePricingMode('Deposit')).toBe('deposit');
    });
  });

  describe('assertModeAllowed / pickDefaultMode', () => {
    it('allows fixed when only fixed is enabled (legacy catalog)', () => {
      const flags: CatalogPricingFlags = {
        allowFixed: true,
        allowVariable: false,
        allowDeposit: false,
        defaultPricingMode: 'fixed',
      };
      expect(() => assertModeAllowed(flags, 'fixed')).not.toThrow();
      expect(() => assertModeAllowed(flags, 'variable')).toThrow(/MODE_NOT_ALLOWED/);
      expect(pickDefaultMode(flags)).toBe('fixed');
    });

    it('falls back when preferred mode is not allowed', () => {
      const flags: CatalogPricingFlags = {
        allowFixed: true,
        allowVariable: false,
        allowDeposit: false,
        defaultPricingMode: 'variable',
      };
      expect(pickDefaultMode(flags)).toBe('fixed');
    });

    it('picks variable when only variable is allowed', () => {
      const flags: CatalogPricingFlags = {
        allowFixed: false,
        allowVariable: true,
        allowDeposit: false,
        defaultPricingMode: 'fixed',
      };
      expect(pickDefaultMode(flags)).toBe('variable');
    });

    it('allows all modes when catalog enables them', () => {
      for (const m of ['fixed', 'variable', 'deposit'] as const) {
        expect(() => assertModeAllowed(allAllowed, m)).not.toThrow();
      }
    });
  });

  describe('resolveOptionDeltas', () => {
    const suggested = { priceDelta: 10000, durationDeltaMin: 15 };

    it('uses catalog suggested when pro has no override', () => {
      expect(resolveOptionDeltas('opt-1', suggested, null)).toEqual({
        priceDelta: 10000,
        durationDeltaMin: 15,
        active: true,
      });
    });

    it('prefers pro override when present', () => {
      const resolved = resolveOptionDeltas('opt-1', suggested, {
        'opt-1': { priceDelta: 25000, durationDeltaMin: 30 },
      });
      expect(resolved.priceDelta).toBe(25000);
      expect(resolved.durationDeltaMin).toBe(30);
      expect(resolved.active).toBe(true);
    });

    it('deactivates option when pro sets active=false', () => {
      const resolved = resolveOptionDeltas('opt-1', suggested, {
        'opt-1': { active: false, priceDelta: 999 },
      });
      expect(resolved.active).toBe(false);
      expect(resolved.priceDelta).toBe(0);
      expect(resolved.durationDeltaMin).toBe(0);
    });
  });

  describe('computeVariableTotals', () => {
    it('returns base when no options selected (fixed-equivalent path)', () => {
      expect(computeVariableTotals(150000, 60, [])).toEqual({
        price: 150000,
        durationMin: 60,
      });
    });

    it('sums option deltas', () => {
      expect(
        computeVariableTotals(100000, 45, [
          { priceDelta: 20000, durationDeltaMin: 10 },
          { priceDelta: 5000, durationDeltaMin: 5 },
        ]),
      ).toEqual({ price: 125000, durationMin: 60 });
    });

    it('clamps price at 0 and duration at 5', () => {
      expect(
        computeVariableTotals(10000, 10, [{ priceDelta: -50000, durationDeltaMin: -20 }]),
      ).toEqual({ price: 0, durationMin: 5 });
    });
  });
});
