#!/usr/bin/env python3
"""#80.7 — public profile service card: variable / deposit display."""
from pathlib import Path

def patch_types() -> None:
    path = Path('frontend/src/types/public.ts')
    t = path.read_text()
    if 'pricingMode' in t and 'attributeGroups' in t:
        print('types already patched')
        return

    old_snip = """export type ServiceSnippet = {
  id: string;
  name: string;
  slug: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};"""
    new_snip = """export type ServiceAttributeOptionPublic = {
  id: string;
  label: string;
  suggestedPriceDelta?: number;
  suggestedDurationDeltaMin?: number;
  isActive?: boolean;
};

export type ServiceAttributeGroupPublic = {
  id: string;
  name: string;
  required?: boolean;
  isActive?: boolean;
  options?: ServiceAttributeOptionPublic[];
};

export type ServiceSnippet = {
  id: string;
  name: string;
  slug: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  attributeGroups?: ServiceAttributeGroupPublic[];
};"""
    if old_snip not in t:
        raise SystemExit('ServiceSnippet missing')
    t = t.replace(old_snip, new_snip, 1)

    old_ps = """export type ProfessionalServiceItem = {
  id: string;
  durationMin: number;
  price: number;
  bufferMin?: number;
  description?: string | null;
  isActive?: boolean;
  service: ServiceSnippet;
  mediaAssets?: ProfessionalServiceMedia[];
  addOns?: ProfessionalServiceAddOn[];
  priceRules?: ProfessionalServicePriceRule[];
  durationRules?: ProfessionalServiceDurationRule[];
};"""
    new_ps = """export type ProfessionalServiceItem = {
  id: string;
  durationMin: number;
  price: number;
  bufferMin?: number;
  description?: string | null;
  isActive?: boolean;
  pricingMode?: string | null;
  depositAmount?: number | null;
  estimateMinPrice?: number | null;
  estimateMaxPrice?: number | null;
  optionDeltas?: Record<
    string,
    { priceDelta?: number; durationDeltaMin?: number; active?: boolean }
  > | null;
  service: ServiceSnippet;
  mediaAssets?: ProfessionalServiceMedia[];
  addOns?: ProfessionalServiceAddOn[];
  priceRules?: ProfessionalServicePriceRule[];
  durationRules?: ProfessionalServiceDurationRule[];
};"""
    if old_ps not in t:
        raise SystemExit('ProfessionalServiceItem missing')
    t = t.replace(old_ps, new_ps, 1)
    path.write_text(t)
    print('types patched', path.stat().st_size)


def patch_card() -> None:
    path = Path('frontend/src/components/professionals/service-offer-card.tsx')
    t = path.read_text()
    if 'pricingMode' in t and 'بیعانه' in t:
        print('card already patched')
        return

    old_state_block = """  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [showAddOns, setShowAddOns] = useState(false);"""
    new_state_block = """  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [showAddOns, setShowAddOns] = useState(false);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const mode = (ps.pricingMode || 'fixed').toLowerCase();
  const attrGroups = (ps.service?.attributeGroups || []).filter((g) => g.isActive !== false);"""
    if old_state_block not in t:
        raise SystemExit('state block missing')
    t = t.replace(old_state_block, new_state_block, 1)

    old_final = """  const basePrice = useMemo(() => {
    if (priceRuleId) {
      const rule = priceRules.find((r) => r.id === priceRuleId);
      if (rule) return rule.price;
    }
    return ps.price || 0;
  }, [priceRuleId, priceRules, ps.price]);

  const baseDuration = useMemo(() => {
    if (durationRuleId) {
      const rule = durationRules.find((r) => r.id === durationRuleId);
      if (rule) return rule.durationMin;
    }
    return ps.durationMin || 0;
  }, [durationRuleId, durationRules, ps.durationMin]);

  const finalPrice = useMemo(() => {
    const extra = addOns
      .filter((a) => selectedAddOns.includes(a.id))
      .reduce((sum, a) => sum + (a.price || 0), 0);
    return basePrice + extra;
  }, [basePrice, addOns, selectedAddOns]);

  const finalDuration = useMemo(() => {
    const extra = addOns
      .filter((a) => selectedAddOns.includes(a.id))
      .reduce((sum, a) => sum + (a.extraDurationMin || 0), 0);
    return baseDuration + extra;
  }, [baseDuration, addOns, selectedAddOns]);"""

    new_final = """  const basePrice = useMemo(() => {
    if (mode === 'deposit' && ps.depositAmount != null) {
      return ps.depositAmount;
    }
    if (priceRuleId) {
      const rule = priceRules.find((r) => r.id === priceRuleId);
      if (rule) return rule.price;
    }
    return ps.price || 0;
  }, [priceRuleId, priceRules, ps.price, ps.depositAmount, mode]);

  const baseDuration = useMemo(() => {
    if (durationRuleId) {
      const rule = durationRules.find((r) => r.id === durationRuleId);
      if (rule) return rule.durationMin;
    }
    return ps.durationMin || 0;
  }, [durationRuleId, durationRules, ps.durationMin]);

  const optionExtra = useMemo(() => {
    if (mode !== 'variable') return { price: 0, duration: 0 };
    let price = 0;
    let duration = 0;
    const deltas = ps.optionDeltas || {};
    for (const g of attrGroups) {
      for (const o of g.options || []) {
 if (o.isActive === false) continue;
        if (!selectedOptionIds.includes(o.id)) continue;
        const ov = deltas[o.id];
        if (ov && ov.active === false) continue;
        price += typeof ov?.priceDelta === 'number' ? ov.priceDelta : o.suggestedPriceDelta || 0;
        duration +=
          typeof ov?.durationDeltaMin === 'number'
            ? ov.durationDeltaMin
            : o.suggestedDurationDeltaMin || 0;
      }
    }
    return { price, duration };
  }, [mode, attrGroups, selectedOptionIds, ps.optionDeltas]);

  const finalPrice = useMemo(() => {
    const extra = addOns
      .filter((a) => selectedAddOns.includes(a.id))
      .reduce((sum, a) => sum + (a.price || 0), 0);
    return basePrice + optionExtra.price + extra;
  }, [basePrice, addOns, selectedAddOns, optionExtra.price]);

  const finalDuration = useMemo(() => {
    const extra = addOns
      .filter((a) => selectedAddOns.includes(a.id))
      .reduce((sum, a) => sum + (a.extraDurationMin || 0), 0);
    return baseDuration + optionExtra.duration + extra;
  }, [baseDuration, addOns, selectedAddOns, optionExtra.duration]);

  const fromPriceLabel = useMemo(() => {
    if (mode !== 'variable') return null;
    if (ps.estimateMinPrice != null && ps.estimateMinPrice > 0) {
      return ps.estimateMinPrice;
    }
    return ps.price || 0;
  }, [mode, ps.estimateMinPrice, ps.price]);"""

    if old_final not in t:
        raise SystemExit('finalPrice block missing')
    t = t.replace(old_final, new_final, 1)

    old_href = """  const bookHref = useMemo(() => {
    if (!slug) return null;
    const params = new URLSearchParams();
    params.set('serviceId', ps.service?.id || '');
    if (selectedAddOns.length) params.set('addOnIds', selectedAddOns.join(','));
    if (priceRuleId) params.set('priceRuleId', priceRuleId);
    if (durationRuleId) params.set('durationRuleId', durationRuleId);
    return `/booking/${slug}?${params.toString()}`;
  }, [slug, ps.service?.id, selectedAddOns, priceRuleId, durationRuleId]);"""
    new_href = """  const bookHref = useMemo(() => {
    if (!slug) return null;
    const params = new URLSearchParams();
    params.set('serviceId', ps.service?.id || '');
    if (selectedAddOns.length) params.set('addOnIds', selectedAddOns.join(','));
    if (selectedOptionIds.length) params.set('optionIds', selectedOptionIds.join(','));
    if (priceRuleId) params.set('priceRuleId', priceRuleId);
    if (durationRuleId) params.set('durationRuleId', durationRuleId);
    return `/booking/${slug}?${params.toString()}`;
  }, [slug, ps.service?.id, selectedAddOns, selectedOptionIds, priceRuleId, durationRuleId]);"""
    if old_href not in t:
        raise SystemExit('bookHref missing')
    t = t.replace(old_href, new_href, 1)

    old_price_line = """          <p className="mt-1 text-sm tabular-nums text-blue">{formatPrice(finalPrice)}</p>
          <p className="text-xs text-gray">{finalDuration} دقیقه</p>"""
    new_price_line = """          <p className="mt-1 text-sm tabular-nums text-blue">
            {mode === 'variable' && fromPriceLabel != null && selectedOptionIds.length === 0
              ? `از ${formatPrice(fromPriceLabel)}`
              : formatPrice(finalPrice)}
            {mode === 'deposit' ? (
              <span className="mr-1 text-xs font-normal text-amber-700"> (بیعانه)</span>
            ) : null}
          </p>
          <p className="text-xs text-gray">{finalDuration} دقیقه</p>
          {mode === 'deposit' && (
            <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
              مبلغ نمایش‌داده‌شده بیعانه است؛ باقی هزینه طبق توافق با زیباگر تسویه می‌شود.
            </p>
          )}"""
    if old_price_line not in t:
        raise SystemExit('price line missing')
    t = t.replace(old_price_line, new_price_line, 1)

    if 'گزینه‌ها' not in t:
        addon_block = """      {addOns.length > 0 && ("""
        insert = """      {mode === 'variable' && attrGroups.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-gray-700">گزینه‌ها (پیش‌نمایش قیمت)</p>
          {attrGroups.map((g) => (
            <div key={g.id}>
              <p className="mb-1 text-[11px] text-gray-500">
                {g.name}
                {g.required ? ' *' : ''}
              </p>
              <div className="flex flex-wrap gap-1">
                {(g.options || [])
                  .filter((o) => o.isActive !== false)
                  .map((o) => {
                    const on = selectedOptionIds.includes(o.id);
                    const ov = ps.optionDeltas?.[o.id];
                    const delta =
                      typeof ov?.priceDelta === 'number'
                        ? ov.priceDelta
                        : o.suggestedPriceDelta || 0;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setSelectedOptionIds((prev) => {
                            const ids = new Set((g.options || []).map((x) => x.id));
                            const without = prev.filter((id) => !ids.has(id));
                            return on ? without : deb [... truncated for length]