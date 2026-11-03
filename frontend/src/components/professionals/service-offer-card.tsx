'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ProfessionalServiceItem } from '@/types/public';
import { formatPrice } from '@/lib/utils';

function isVideo(mime?: string) {
  return (mime || '').startsWith('video/');
}

type Props = {
  ps: ProfessionalServiceItem & {
    description?: string | null;
    mediaAssets?: Array<{ id: string; publicUrl?: string | null; url?: string | null; mimeType?: string | null }>;
    addOns?: Array<{ id: string; name: string; price: number; isActive?: boolean }>;
    priceRules?: Array<{ id: string; label: string; price: number }>;
    durationRules?: Array<{ id: string; label: string; durationMin: number }>;
  };
  slug: string;
};

export function ServiceOfferCard({ ps, slug }: Props) {
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [priceRuleId, setPriceRuleId] = useState<string | undefined>(
    ps.priceRules?.[0]?.id,
  );
  const [durationRuleId, setDurationRuleId] = useState<string | undefined>(
    ps.durationRules?.[0]?.id,
  );

  const basePrice = useMemo(() => {
    const rule = ps.priceRules?.find((r) => r.id === priceRuleId);
    return rule?.price ?? ps.price ?? 0;
  }, [ps.price, ps.priceRules, priceRuleId]);

  const addOnTotal = useMemo(() => {
    return (ps.addOns || [])
      .filter((a) => a.isActive !== false && selectedAddOns.includes(a.id))
      .reduce((s, a) => s + (a.price || 0), 0);
  }, [ps.addOns, selectedAddOns]);

  const finalPrice = basePrice + addOnTotal;

  const bookHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('serviceId', ps.service?.id || '');
    if (selectedAddOns.length) params.set('addOnIds', selectedAddOns.join(','));
    if (priceRuleId) params.set('priceRuleId', priceRuleId);
    if (durationRuleId) params.set('durationRuleId', durationRuleId);
    return `/booking/${slug}?${params.toString()}`;
  }, [slug, ps.service?.id, selectedAddOns, priceRuleId, durationRuleId]);

  function toggle(id: string) {
    setSelectedAddOns((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const media = (ps.mediaAssets || []).filter((m) => (m.publicUrl || m.url || '').trim());

  return (
    <li className="rounded-2xl border border-border/90 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        {media[0] && !isVideo(media[0].mimeType) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(media[0].publicUrl || media[0].url)!}
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
          <p className="text-xs text-gray">{ps.durationMin} دقیقه</p>
        </div>
      </div>

      {ps.priceRules && ps.priceRules.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {ps.priceRules.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setPriceRuleId(r.id)}
              className={`rounded-full px-2.5 py-1 text-xs ${
                priceRuleId === r.id ? 'bg-coral text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {ps.addOns && ps.addOns.filter((a) => a.isActive !== false).length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-gray">افزودنی‌ها</p>
          <ul className="space-y-1">
            {ps.addOns
              .filter((a) => a.isActive !== false)
              .map((a) => {
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
