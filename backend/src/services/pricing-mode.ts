/** Issue #80 — three-layer pricing helpers (fixed / variable / deposit). */

export type PricingMode = 'fixed' | 'variable' | 'deposit';

export type CatalogPricingFlags = {
  allowFixed: boolean;
  allowVariable: boolean;
  allowDeposit: boolean;
  defaultPricingMode: string;
};

export function normalizePricingMode(raw: unknown): PricingMode {
  const v = String(raw || 'fixed').toLowerCase();
  if (v === 'variable' || v === 'deposit' || v === 'fixed') return v;
  return 'fixed';
}

/** Only modes allowed by catalog flags may be used. */
export function assertModeAllowed(
  flags: CatalogPricingFlags,
  mode: PricingMode,
): void {
  if (mode === 'fixed' && flags.allowFixed) return;
  if (mode === 'variable' && flags.allowVariable) return;
  if (mode === 'deposit' && flags.allowDeposit) return;
  throw new Error(`MODE_NOT_ALLOWED:${mode}`);
}

export function pickDefaultMode(flags: CatalogPricingFlags): PricingMode {
  const preferred = normalizePricingMode(flags.defaultPricingMode);
  try {
    assertModeAllowed(flags, preferred);
    return preferred;
  } catch {
    if (flags.allowFixed) return 'fixed';
    if (flags.allowVariable) return 'variable';
    if (flags.allowDeposit) return 'deposit';
    return 'fixed';
  }
}

export type OptionDelta = {
  priceDelta?: number;
  durationDeltaMin?: number;
  active?: boolean;
};

/** Resolve option deltas: pro override wins, else catalog suggested. */
export function resolveOptionDeltas(
  optionId: string,
  suggested: { priceDelta: number; durationDeltaMin: number },
  optionDeltas: Record<string, OptionDelta> | null | undefined,
): { priceDelta: number; durationDeltaMin: number; active: boolean } {
  const o = optionDeltas?.[optionId];
  if (o && o.active === false) {
    return { priceDelta: 0, durationDeltaMin: 0, active: false };
  }
  return {
    priceDelta: typeof o?.priceDelta === 'number' ? o.priceDelta : suggested.priceDelta,
    durationDeltaMin:
      typeof o?.durationDeltaMin === 'number' ? o.durationDeltaMin : suggested.durationDeltaMin,
    active: o?.active !== false,
  };
}

export function computeVariableTotals(
  basePrice: number,
  baseDuration: number,
  selected: Array<{ priceDelta: number; durationDeltaMin: number }>,
): { price: number; durationMin: number } {
  const price = Math.max(0, basePrice + selected.reduce((s, x) => s + (x.priceDelta || 0), 0));
  const durationMin = Math.max(
    5,
    baseDuration + selected.reduce((s, x) => s + (x.durationDeltaMin || 0), 0),
  );
  return { price, durationMin };
}
