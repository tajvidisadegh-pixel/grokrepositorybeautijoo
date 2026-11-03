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
  }, [baseDuration, addOns, selectedAddOns]);

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
    if (priceRuleId) params.set('priceRuleId', priceRuleId);
    if (durationRuleId) params.set('durationRuleId', durationRuleId);
    return `/booking/${slug}?${params.toString()}`;
  }, [slug, ps.service?.id, selectedAddOns, priceRuleId, durationRuleId]);

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
          <p className="mt-1 text-sm tabular-nums text-blue">{formatPrice(finalPrice)}</p>
          <p className="text-xs text-gray">{finalDuration} دقیقه</p>
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
