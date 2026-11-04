#!/usr/bin/env python3
"""#80.6 — customer booking UI: options + deposit + selectedOptionIds."""
from pathlib import Path

def patch_public_include() -> None:
    path = Path('backend/src/professionals/professionals.service.ts')
    t = path.read_text()
    idx = t.find('private publicInclude')
    chunk = t[idx:idx+1200] if idx >= 0 else ''
    if 'attributeGroups' in chunk:
        print('publicInclude already has attributeGroups')
        return
    old = """      professionalServices: {
        where: { isActive: true },
        include: {
          service: { include: { category: true } },
          mediaAssets: { orderBy: { sortOrder: 'asc' as const } },
          addOns: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
          priceRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
          durationRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
        },
      },"""
    new = """      professionalServices: {
        where: { isActive: true },
        include: {
          service: {
            include: {
              category: true,
              attributeGroups: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' as const },
                include: {
                  options: {
                    where: { isActive: true },
                    orderBy: { sortOrder: 'asc' as const },
                  },
                },
              },
            },
          },
          mediaAssets: { orderBy: { sortOrder: 'asc' as const } },
          addOns: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
          priceRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
          durationRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' as const } },
        },
      },"""
    if old not in t:
        raise SystemExit('publicInclude professionalServices block missing')
    path.write_text(t.replace(old, new, 1))
    print('professionals.service publicInclude patched', path.stat().st_size)


def patch_types() -> None:
    path = Path('frontend/src/types/booking.ts')
    t = path.read_text()
    if 'selectedOptionIds' in t:
        print('types already patched')
        return
    old = """export type CreateBookingPayload = {
  professionalId: string;
  serviceIds: string[];
  startAt: string; // ISO
  locationId?: string;
  notes?: string;
  addOnIds?: string[];
  priceRuleId?: string;
  durationRuleId?: string;
};"""
    new = """export type CreateBookingPayload = {
  professionalId: string;
  serviceIds: string[];
  startAt: string; // ISO
  locationId?: string;
  notes?: string;
  addOnIds?: string[];
  priceRuleId?: string;
  durationRuleId?: string;
  /** Attribute option ids for variable pricing (#80) */
  selectedOptionIds?: string[];
};"""
    if old not in t:
        raise SystemExit('CreateBookingPayload missing')
    t = t.replace(old, new, 1)
    old_draft = """  addOnIds?: string[];
  priceRuleId?: string;
  durationRuleId?: string;
};"""
    new_draft = """  addOnIds?: string[];
  priceRuleId?: string;
  durationRuleId?: string;
  selectedOptionIds?: string[];
};"""
    if old_draft not in t:
        raise SystemExit('BookingDraft tail missing')
    t = t.replace(old_draft, new_draft, 1)
    path.write_text(t)
    print('types patched', path.stat().st_size)


def patch_booking_page() -> None:
    path = Path('frontend/src/app/booking/[slug]/page.tsx')
    t = path.read_text()
    if 'pricingMode' in t and 'attributeGroups' in t:
        print('booking page already patched')
        return
    old = """  const services = (pro.professionalServices || []).map((ps) => ({
    professionalServiceId: ps.id,
    serviceId: ps.service.id,
    name: ps.service.name,
    durationMin: ps.durationMin,
    bufferMin: ps.bufferMin ?? 0,
    price: ps.price,
    categoryName: ps.service.category?.name,
    addOns: (ps.addOns || []).map((a) => ({
      id: a.id,
      name: a.name,
      price: a.price,
      extraDurationMin: a.extraDurationMin || 0,
    })),
    priceRules: (ps.priceRules || []).map((r) => ({
      id: r.id,
      label: r.label,
      price: r.price,
    })),
    durationRules: (ps.durationRules || []).map((r) => ({
      id: r.id,
      label: r.label,
      durationMin: r.durationMin,
    })),
  }));"""
    new = """  const services = (pro.professionalServices || []).map((ps: any) => ({
    professionalServiceId: ps.id,
    serviceId: ps.service.id,
    name: ps.service.name,
    durationMin: ps.durationMin,
    bufferMin: ps.bufferMin ?? 0,
    price: ps.price,
    categoryName: ps.service.category?.name,
    pricingMode: (ps.pricingMode as string) || 'fixed',
    depositAmount: ps.depositAmount ?? null,
    estimateMinPrice: ps.estimateMinPrice ?? null,
    estimateMaxPrice: ps.estimateMaxPrice ?? null,
    optionDeltas: ps.optionDeltas || null,
    attributeGroups: (ps.service?.attributeGroups || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      required: g.required !== false,
      options: (g.options || []).map((o: any) => ({
        id: o.id,
        label: o.label,
        suggestedPriceDelta: o.suggestedPriceDelta ?? 0,
        suggestedDurationDeltaMin: o.suggestedDurationDeltaMin ?? 0,
      })),
    })),
    addOns: (ps.addOns || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      price: a.price,
      extraDurationMin: a.extraDurationMin || 0,
    })),
    priceRules: (ps.priceRules || []).map((r: any) => ({
      id: r.id,
      label: r.label,
      price: r.price,
    })),
    durationRules: (ps.durationRules || []).map((r: any) => ({
      id: r.id,
      label: r.label,
      durationMin: r.durationMin,
    })),
  }));"""
    if old not in t:
        raise SystemExit('booking page services map missing')
    path.write_text(t.replace(old, new, 1))
    print('booking page patched', path.stat().st_size)


def patch_wizard() -> None:
    path = Path('frontend/src/components/booking/booking-wizard.tsx')
    t = path.read_text()
    if 'selectedOptionIds' in t and 'گزینه‌های خدمت' in t:
        print('wizard already patched')
        return

    old_type = """type ServiceOption = {
  professionalServiceId: string;
  serviceId: string;
  name: string;
  durationMin: number;
  bufferMin: number;
  price: number;
  categoryName?: string;
  addOns?: { id: string; name: string; price: number; extraDurationMin: number }[];
  priceRules?: { id: string; label: string; price: number }[];
  durationRules?: { id: string; label: string; durationMin: number }[];
};"""
    new_type = """type AttrOption = {
  id: string;
  label: string;
  suggestedPriceDelta: number;
  suggestedDurationDeltaMin: number;
};
type AttrGroup = {
  id: string;
  name: string;
  required: boolean;
  options: AttrOption[];
};
type ServiceOption = {
  professionalServiceId: string;
  serviceId: string;
  name: string;
  durationMin: number;
  bufferMin: number;
  price: number;
  categoryName?: string;
  pricingMode?: string;
  depositAmount?: number | null;
  estimateMinPrice?: number | null;
  estimateMaxPrice?: number | null;
  optionDeltas?: Record<string, { priceDelta?: number; durationDeltaMin?: number; active?: boolean }> | null;
  attributeGroups?: AttrGroup[];
  addOns?: { id: string; name: string; price: number; extraDurationMin: number }[];
  priceRules?: { id: string; label: string; price: number }[];
  durationRules?: { id: string; label: string; durationMin: number }[];
};"""
    if old_type not in t:
        raise SystemExit('ServiceOption type missing')
    t = t.replace(old_type, new_type, 1)

    marker = 'const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>(initialAddOnIds || []);'
    if marker not in t:
        raise SystemExit('selectedAddOnIds state missing')
    if 'selectedOptionIds' not in t:
        t = t.replace(
            marker,
            marker + "\n  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([])",
            1,
        )

    anchor = """  const selected = useMemo(
    () => services.find((s) => s.serviceId === serviceId) || null,
    [services, serviceId],
  );"""
    if anchor not in t:
        raise SystemExit('selected useMemo missing')
    if 'setSelectedOptionIds([])' not in t:
        t = t.replace(
            anchor,
            anchor
            + """

  useEffect(() => {
    setSelectedOptionIds([]);
  }, [selected?.serviceId]);
""",
            1,
        )

    old_base = """  const basePrice = useMemo(() => {
    if (!selected) return 0;
    if (priceRuleId) {
      const rule = (selected.priceRules || []).find((r) => r.id === priceRuleId);
      if (rule) return rule.price;
    }
    return selected.price;
  }, [selected, priceRuleId]);

  const baseDuration = useMemo(() => {
    if (!selected) return 0;
    if (durationRuleId) {
      const rule = (selected.durationRules || []).find((r) => r.id === durationRuleId);
      if (rule) return rule.durationMin;
    }
    return selected.durationMin;
  }, [selected, durationRuleId]);

  const addOnExtraPrice = useMemo(() => {
    if (!selected) return 0;
    return (selected.addOns || [])
      .filter((a) => selectedAddOnIds.includes(a.id))
      .reduce((s, a) => s + a.price, 0);
  }, [selected, selectedAddOnIds]);

  const addOnExtraDuration = useMemo(() => {
    if (!selected) return 0;
    return (selected.addOns || [])
      .filter((a) => selectedAddOnIds.includes(a.id))
      .reduce((s, a) => s + (a.extraDurationMin || 0), 0);
  }, [selected, selectedAddOnIds]);

  const displayPrice = basePrice + addOnExtraPrice;
  const serviceDuration = baseDuration + addOnExtraDuration;"""

    new_base = """  const mode = (selected?.pricingMode || 'fixed').toLowerCase();

  const optionExtras = useMemo(() => {
    if (!selected || mode !== 'variable') return { price: 0, duration: 0 };
    let price = 0;
    let duration = 0;
    const deltas = selected.optionDeltas || {};
    for (const g of selected.attributeGroups || []) {
      for (const o of g.options || []) {
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
  }, [selected, mode, selectedOptionIds]);

  const basePrice = useMemo(() => {
    if (!selected) return 0;
    if (mode === 'deposit') {
      return selected.depositAmount != null ? selected.depositAmount : selected.price;
    }
    if (priceRuleId) {
      const rule = (selected.priceRules || []).find((r) => r.id === priceRuleId);
      if (rule) return rule.price;
    }
    return selected.price;
  }, [selected, priceRuleId, mode]);

  const baseDuration = useMemo(() => {
    if (!selected) return 0;
    if (durationRuleId) {
      const rule = (selected.durationRules || []).find((r) => r.id === durationRuleId);
      if (rule) return rule.durationMin;
    }
    return selected.durationMin;
  }, [selected, durationRuleId]);

  const addOnExtraPrice = useMemo(() => {
    if (!selected) return 0;
    return (selected.addOns || [])
      .filter((a) => selectedAddOnIds.includes(a.id))
      .reduce((s, a) => s + a.price, 0);
  }, [selected, selectedAddOnIds]);

  const addOnExtraDuration = useMemo(() => {
    if (!selected) return 0;
    return (selected.addOns || [])
      .filter((a) => selectedAddOnIds.includes(a.id))
      .reduce((s, a) => s + (a.extraDurationMin || 0), 0);
  }, [selected, selectedAddOnIds]);

  const displayPrice = basePrice + optionExtras.price + addOnExtraPrice;
  const serviceDuration = baseDuration + optionExtras.duration + addOnExtraDuration;"""

    if old_base not in t:
        raise SystemExit('basePrice block missing')
    t = t.replace(old_base, new_base, 1)

    insert_at = t.find("  if (services.length === 0)")
    if insert_at < 0:
        raise SystemExit('services.length guard missing')
    if 'function goToDatetime' not in t:
        fn = """
  function goToDatetime() {
    if (!selected) return;
    if (mode === 'variable') {
      for (const g of selected.attributeGroups || []) {
        if (!g.required) continue;
        const ok = (g.options || []).some((o) => selectedOptionIds.includes(o.id));
        if (!ok) {
          setError(`لطفاً «${g.name}» را انتخاب کنید`);
          return;
        }
      }
    }
    setError(null);
    setStep('datetime');
  }

"""
        t = t[:insert_at] + fn + t[insert_at:]
        t = t.replace("onClick={() => selected && setStep('datetime')}", "onClick={() => goToDatetime()}")
        t = t.replace("onClick={() => { if (selected) setStep('datetime'); }}", "onClick={() => goToDatetime()}")

    old_addons_create = "        addOnIds: selectedAddOnIds.length ? selectedAddOnIds : undefined,"
    if old_addons_create in t and 'selectedOptionIds: selectedOptionIds.length' not in t:
        t = t.replace(
            old_addons_create,
            old_addons_create
            + "\n        selectedOptionIds: selectedOptionIds.length ? selectedOptionIds : undefined,",
            1,
        )

    old_draft_addons = "      addOnIds: selectedAddOnIds.length ? selectedAddOnIds : undefined,"
    if old_draft_addons in t and t.count('selectedOptionIds: selectedOptionIds.length') < 2:
        t = t.replace(
            old_draft_addons,
            old_draft_addons
            + "\n      selectedOptionIds: selectedOptionIds.length ? selectedOptionIds : undefined,",
            1,
        )

    if 'گزینه‌های خدمت' not in t:
        insert_ui = """
            {selected && mode === 'variable' && (selected.attributeGroups || []).length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-[#0B2C4A]">گزینه‌های خدمت</p>
                {(selected.attributeGroups || []).map((g) => (
                  <div key={g.id} className="rounded-xl border border-gray-200 bg-white p-3">
                    <p className="mb-2 text-xs font-medium text-gray-700">
                      {g.name}
                      {g.required ? <span className="text-red-500"> *</span> : null}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(g.options || []).map((o) => {
                        const on = selectedOptionIds.includes(o.id);
                        const ov = selected.optionDeltas?.[o.id];
                        const delta =
                          typeof ov?.priceDelta === 'number' ? ov.priceDelta : o.suggestedPriceDelta || 0;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => {
                              setSelectedOptionIds((prev) => {
                                const groupIds = new Set((g.options || []).map((x) => x.id));
                                const without = prev.filter((id) => !groupIds.has(id));
                                return on ? without : [...without, o.id];
                              });
                            }}
                            className={`rounded-xl border px-3 py-2 text-xs ${
                              on
                                ? 'border-[#0B2C4A] bg-[#0B2C4A] text-white'
                                : 'border-gray-200 bg-white text-gray-800'
                            }`}
                          >
                            {o.label}
                            {delta !== 0 && (
                              <span className="mr-1 opacity-80">
                                {delta > 0 ? '+' : ''}
                                {delta.toLocaleString('fa-IR')}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selected && mode === 'deposit' && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                مبلغ قابل پرداخت الان به‌صورت بیعانه است
                {selected.depositAmount != null
                  ? ` (${formatPrice(selected.depositAmount)})`
                  : ''}
                . باقی مبلغ طبق توافق با زیباگر تسویه می‌شود.
              </div>
            )}
"""
        found = False
        for m in [
            "{(selected?.addOns || []).filter",
            "{(selected?.addOns || []).length",
            "{selected && (selected.addOns || []).length",
        ]:
            if m in t:
                t = t.replace(m, insert_ui + m, 1)
                found = True
                break
        if not found:
            m2 = "{step === 'datetime'"
            if m2 in t:
                t = t.replace(m2, insert_ui + m2, 1)

    path.write_text(t)
    print('wizard patched', path.stat().st_size)


if __name__ == '__main__':
    patch_public_include()
    patch_types()
    patch_booking_page()
    patch_wizard()
