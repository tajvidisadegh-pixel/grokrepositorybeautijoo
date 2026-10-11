'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type MatrixCell = {
  label: string;
  price: number;
  ruleId?: string;
};

type Props = {
  title: string;
  cells: MatrixCell[];
  busy?: boolean;
  minPrice?: number;
  onSaveCell: (label: string, price: number, ruleId?: string) => Promise<void>;
  onBatchApply: (labels: string[], price: number) => Promise<void>;
};

const DEFAULT_MIN = 10_000;

/** جدول قیمت — تکی و دسته‌ای، UI واضح‌تر برای موبایل */
export function PriceMatrix({
  title,
  cells,
  busy,
  minPrice = DEFAULT_MIN,
  onSaveCell,
  onBatchApply,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchPrice, setBatchPrice] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const allLabels = useMemo(() => cells.map((c) => c.label), [cells]);

  function toggle(label: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });
  }

  function toggleAll() {
    if (selected.size === allLabels.length) setSelected(new Set());
    else setSelected(new Set(allLabels));
  }

  function parsePrice(raw: string) {
    return Math.max(0, Math.round(Number(String(raw).replace(/,/g, '')) || 0));
  }

  async function applyBatch() {
    const price = parsePrice(batchPrice);
    if (!selected.size || price < minPrice) return;
    await onBatchApply([...selected], price);
    setDrafts((d) => {
      const n = { ...d };
      for (const l of selected) n[l] = String(price);
      return n;
    });
    setSelected(new Set());
    setBatchPrice('');
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-navy">{title}</h3>
            <p className="mt-0.5 text-xs text-gray">
              حداقل {minPrice.toLocaleString('fa-IR')} تومان
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-coral"
            onClick={toggleAll}
          >
            {selected.size === allLabels.length && allLabels.length > 0
              ? 'لغو همه'
              : 'انتخاب همه'}
          </button>
        </div>

        {/* Batch bar */}
        <div className="mb-4 rounded-2xl bg-gradient-to-l from-[#FFE6E2] to-[#FFF5F3] p-3 ring-1 ring-coral/20">
          <p className="mb-2 text-sm font-semibold text-navy">اعمال یک قیمت روی چند مورد</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              className="flex-1 bg-white text-base"
              inputMode="numeric"
              placeholder={`مثلاً ${minPrice.toLocaleString('fa-IR')}`}
              value={batchPrice}
              onChange={(e) => setBatchPrice(e.target.value)}
              dir="ltr"
            />
            <Button
              className="w-full sm:w-auto"
              disabled={busy || selected.size === 0 || parsePrice(batchPrice) < minPrice}
              onClick={() => void applyBatch()}
            >
              اعمال روی{' '}
              {selected.size > 0 ? selected.size.toLocaleString('fa-IR') : '۰'} مورد
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-gray">
            اول ردیف‌ها را تیک بزن، قیمت را بنویس، بعد اعمال کن.
          </p>
        </div>

        {/* Rows */}
        <ul className="space-y-2">
          {cells.length === 0 && (
            <li className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-gray">
              ردیف قیمتی تعریف نشده
            </li>
          )}
          {cells.map((c) => {
            const val = drafts[c.label] ?? (c.price > 0 ? String(c.price) : '');
            const saved = c.price >= minPrice;
            return (
              <li
                key={c.label}
                className={`rounded-xl border px-3 py-3 transition ${
                  selected.has(c.label)
                    ? 'border-coral bg-[#FFE6E2]/50'
                    : 'border-border bg-white'
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#fc7074]"
                    checked={selected.has(c.label)}
                    onChange={() => toggle(c.label)}
                    aria-label={c.label}
                  />
                  <span className="flex-1 text-sm font-semibold text-navy">{c.label}</span>
                  {saved ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      {c.price.toLocaleString('fa-IR')} ت
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                      بدون قیمت
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    className="flex-1 bg-white text-base"
                    inputMode="numeric"
                    dir="ltr"
                    value={val}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.label]: e.target.value }))}
                    placeholder={String(minPrice)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 px-4"
                    disabled={busy || parsePrice(val) < minPrice}
                    onClick={() => void onSaveCell(c.label, parsePrice(val), c.ruleId)}
                  >
                    ذخیره
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
