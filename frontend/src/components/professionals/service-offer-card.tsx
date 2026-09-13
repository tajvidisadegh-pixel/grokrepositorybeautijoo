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

  const displayPriceLabel =
    priceRules.length > 1 && !priceRuleId
      ? `از ${formatPrice(priceRules[0].price)}`
      : formatPrice(finalPrice);

  return (
    <li className="rounded-2xl border border-border/90 bg-white p-4 shadow-[0_1px_2px_rgba(31,41,55,0.04)] transition-colors hover:border-coral/25">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{ps.service.name}</p>
          <p className="mt-0.5 text-xs text-gray">
            {finalDuration ? `${finalDuration} دقیقه` : ''}
          </p>
        </div>
        <p className="font-semibold tabular-nums text-blue">{displayPriceLabel}</p>
      </div>

      {priceRules.length > 0 && (
        <ul className="mt-3 space-y-1 border-r border-border pr-2.5">
          {priceRules.map((r) => {
            const on = priceRuleId === r.id;
            const dur =
              durationRules.find((d) => d.label === r.label)?.durationMin ?? baseDuration;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => selectPriceRule(r.id)}
                  className={`flex w-full items-center justify-between py-1.5 text-right text-sm ${
                    on ? 'font-medium text-coral' : 'text-gray'
                  }`}
                >
                  <span>
                    {on ? '● ' : '○ '}
                    {r.label}
                    {dur ? <span className="mr-1 text-xs text-gray-muted">· {dur}د</span> : null}
                  </span>
                  <span className="tabular-nums">{formatPrice(r.price)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {media.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {media.map((m) =>
            isVideo(m.mimeType) ? (
              <video
                key={m.id}
                src={m.publicUrl}
                className="aspect-square w-full rounded-xl object-cover"
                controls
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.id}
                src={m.publicUrl}
                alt=""
                className="aspect-square w-full rounded-xl object-cover"
              />
            ),
          )}
        </div>
      )}

      {addOns.length > 0 && (
        <div className="mt-3 border-t border-border/80 pt-2">
          {!showAddOns ? (
            <button
              type="button"
              onClick={() => setShowAddOns(true)}
              className="text-xs font-medium text-coral hover:text-coral-dark"
            >
              ＋ گزینه‌های اضافی
            </button>
          ) : (
            <ul className="space-y-1.5">
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
