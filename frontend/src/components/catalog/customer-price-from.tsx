'use client';

import { useMemo, useState } from 'react';
import { formatPrice } from '@/lib/utils';

export type PublicPriceRule = { label: string; price: number };

/** نمایش ساده مشتری: از قیمت + انتخاب بُعد */
export function CustomerPriceFrom({
  basePrice,
  rules,
  className = '',
}: {
  basePrice?: number | null;
  rules?: PublicPriceRule[] | null;
  className?: string;
}) {
  const active = useMemo(
    () => (rules || []).filter((r) => r.price > 0),
    [rules],
  );
  const [label, setLabel] = useState<string | null>(null);

  const selected = active.find((r) => r.label === label);
  const min = active.length
    ? Math.min(...active.map((r) => r.price))
    : basePrice && basePrice > 0
      ? basePrice
      : null;

  const display = selected?.price ?? min;

  if (display == null) return null;

  return (
    <div className={`space-y-2 ${className}`} dir="rtl">
      <p className="text-sm font-semibold text-coral">
        {selected ? formatPrice(selected.price) : `از ${formatPrice(display)}`}
      </p>
      {active.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {active.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setLabel(r.label === label ? null : r.label)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                label === r.label
                  ? 'border-coral bg-coral text-white'
                  : 'border-border bg-white text-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
