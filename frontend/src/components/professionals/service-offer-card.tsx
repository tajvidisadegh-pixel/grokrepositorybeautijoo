'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ProfessionalServiceItem } from '@/types/public';
import { formatPrice } from '@/lib/utils';

function isVideo(mime?: string) {
  return (mime || '').startsWith('video/');
}

export function ServiceOfferCard({ ps, slug }: { ps: ProfessionalServiceItem; slug?: string }) {
  const addOns = (ps.addOns || []).filter((a) => a.isActive !== false);
  const media = ps.mediaAssets || [];
  const priceRules = (ps.priceRules || [])
    .filter((r) => r.isActive !== false)
    .slice()
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const durationRules = (ps.durationRules || []).filter((r) => r.isActive !== false);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [showAddOns, setShowAddOns] = useState(false);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const mode = (ps.pricingMode || 'fixed').toLowerCase();
  const attrGroups = (ps.service?.attributeGroups || []).filter((g) => g.isActive !== false);
  const cheapest = priceRules[0] || null;
  const [priceRuleId, setPriceRuleId] = useState<string | null>(cheapest ? cheapest.id : null);
  const [durationRuleId, setDurationRuleId] = useState<string | null>(() => {
    if (!durationRules.length) return null;
    if (cheapest) {
      const match = durationRules.find((d) => d.label === cheapest.label);
      return (match || durationRules[0]).id;
    }
    return durationRules[0].id;
  });

  const basePrice = useMemo(() => {
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
  }, [mode, ps.estimateMinPrice, ps.price]);

  function toggle(id: string) {
    setSelectedAddOns((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function selectPriceRule(id: string) {
    setPriceRuleId(id);
    const rule = priceRules.find((r) => r.id === id);
    if (rule) {
      const match = durationRules.find((d) => d.label === rule.label);
      if (match) setDurationRuleId(match.id);
    }
  }

  const bookHref = useMemo(() => {
    if (!slug) return null;
    const params = new URLSearchParams();
    params.set('serviceId', ps.service?.id || '');
    if (selectedAddOns.length) params.set('addOnIds', selectedAddOns.join(','));
    if (selectedOptionIds.length) params.set('optionIds', selectedOptionIds.join(','));
    if (priceRuleId) params.set('priceRuleId', priceRuleId);
    if (durationRuleId) params.set('durationRuleId', durationRuleId);
    return `/booking/${slug}?${params.toString()}`;
  }, [slug, ps.service?.id, selectedAddOns, selectedOptionIds, priceRuleId, durationRuleId]);

  const thumb = media.find((m) => m.publicUrl && !isVideo(m.mimeType));

  return (
    <li className="rounded-2xl border border-border/90 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb.publicUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-xl object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{ps.service.name}</p>
          {ps.description ? (
            <p className="mt-1 text-sm leading-relaxed text-gray-600">{ps.description}</p>
          ) : null}
          <p className="mt-1 text-sm tabular-nums text-blue">
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
          )}
        </div>
      </div>

      {priceRules.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {priceRules.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => selectPriceRule(r.id)}
              className={`rounded-full px-2.5 py-1 text-xs ${
                priceRuleId === r.id ? 'bg-coral text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {mode === 'variable' && attrGroups.length > 0 && (
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
                            return on ? without : [...without, o.id];
                          });
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          on ? 'bg-[#0B2C4A] text-white' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {o.label}
                        {delta !== 0 && (
                          <span className="mr-1 opacity-80">
                            {delta > 0 ? '+' : ''}
                            {Number(delta).toLocaleString('fa-IR')}
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

      {addOns.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            className="text-xs text-coral"
            onClick={() => setShowAddOns((v) => !v)}
          >
            {showAddOns ? 'بستن افزودنی‌ها' : `افزودنی‌ها (${addOns.length})`}
          </button>
          {showAddOns && (
            <ul className="mt-2 space-y-1">
              {addOns.map((a) => {
                const on = selectedAddOns.includes(a.id);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => toggle(a.id)}
                      className="flex w-full items-center justify-between py-1.5 text-right text-sm text-foreground"
                    >
                      <span>
                        {on ? '☑ ' : '☐ '}
                        {a.name}
                      </span>
                      <span className="tabular-nums text-gray">{formatPrice(a.price)}</span>
                    </button>
                  </li>
                );
              })}
              <div className="flex justify-between pt-1 text-sm">
                <span className="text-gray">جمع</span>
                <span className="font-semibold tabular-nums text-blue">
                  {formatPrice(finalPrice)}
                </span>
              </div>
            </ul>
          )}
        </div>
      )}

      {bookHref && (
        <Link
          href={bookHref}
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-coral text-sm font-medium text-white transition-colors hover:bg-coral-dark"
        >
          رزرو
        </Link>
      )}
    </li>
  );
}
