'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatPriceDigits, parsePriceInput } from '@/lib/utils';
import type { ProfessionalServiceItem, ServiceAddOnItem, PriceRuleItem, DurationRuleItem } from '@/lib/panel-api';

/** Minimal inline editor for a professional service (price / duration / active). */
export function ServiceEditPanel({
  ps,
  onSave,
  onCancel,
  busy,
}: {
  ps: ProfessionalServiceItem;
  onSave: (patch: {
    price?: number;
    durationMin?: number;
    isActive?: boolean;
    description?: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}) {
  const [price, setPrice] = useStateNumber(ps.price);
  const [durationMin, setDurationMin] = useStateNumber(ps.durationMin);
  const [isActive, setIsActive] = useStateBool(ps.isActive !== false);
  const [description, setDescription] = useStateStr(ps.description || '');

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-border bg-gray-light/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500">قیمت (تومان)</label>
          <Input
            inputMode="numeric"
            min={10000}
            value={price ? formatPriceDigits(price) : ''}
            onChange={(e) => setPrice(parsePriceInput(e.target.value))}
          />
          {price != null && price > 0 && price < 10000 && (
            <p className="mt-1 text-xs font-medium text-red-600">قیمت باید حداقل ۱۰٬۰۰۰ تومان باشد.</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">مدت (دقیقه)</label>
          <Input
            inputMode="numeric"
            value={durationMin ? String(durationMin) : ''}
            onChange={(e) => setDurationMin(parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-500">توضیح کوتاه (اختیاری)</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        فعال برای رزرو
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy || (price != null && price > 0 && price < 10000)}
          onClick={() =>
            onSave({
              price: price || undefined,
              durationMin: durationMin || undefined,
              isActive,
              description: description.trim() || null,
            })
          }
        >
          ذخیره
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          انصراف
        </Button>
      </div>
    </div>
  );
}

function useStateNumber(initial: number | null | undefined) {
  const { useState } = require('react') as typeof import('react');
  return useState<number | null>(initial ?? null);
}
function useStateBool(initial: boolean) {
  const { useState } = require('react') as typeof import('react');
  return useState(initial);
}
function useStateStr(initial: string) {
  const { useState } = require('react') as typeof import('react');
  return useState(initial);
}
