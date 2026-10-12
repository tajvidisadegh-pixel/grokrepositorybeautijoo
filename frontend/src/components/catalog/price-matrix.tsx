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
  /** مدت زمان — کنار قیمت در همان کارت */
  durationMin?: number;
  onDurationChange?: (minutes: number) => void;
  onSaveDuration?: () => void | Promise<void>;
  onSaveCell: (label: string, price: number, ruleId?: string) => Promise<void>;
  onBatchApply: (labels: string[], price: number) => Promise<void>;
};

const DEFAULT_MIN = 10_000;

/** جدول قیمت + مدت در یک کارت — موبایل‌اول */
export function PriceMatrix({
  title,
  cells,
  busy,
  minPrice = DEFAULT_MIN,
  durationMin,
  onDurationChange,
  onSaveDuration,
  onSaveCell,
  onBatchApply,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchPrice, setBatchPrice] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const allLabels = useMemo(() => cells.map((c) => c.label), [cells]);
  const filledCount = useMemo(
    () => cells.filter((c) => c.price >= minPrice).length,
    [cells, minPrice],
  );

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

  const showDuration = typeof durationMin === 'number' && onDurationChange;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm" dir="rtl">
      <div className="border-b border-border bg-gradient-to-l from-[#FFF5F3] to-white px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-navy">{title}</h3>
            <p className="mt-1 text-xs text-gray">
              {filledCount.toLocaleString('fa-IR')} از {cells.length.toLocaleString('fa-IR')} ردیف قیمت
              دارد · حداقل {minPrice.toLocaleString('fa-IR')} ت
            </p>
          </div>
          {allLabels.length > 0 && (
            <button
              type="button"
              className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium text-coral ring-1 ring-coral/30"
              onClick={toggleAll}
            >
              {selected.size === allLabels.length ? 'لغو همه' : 'انتخاب همه'}
            </button>
          )}
        </div>

        {showDuration && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-white/80 p-3 ring-1 ring-border">
            <div className="min-w-[7.5rem] flex-1">
              <label className="mb-1 block text-[11px] font-medium text-gray">مدت زمان</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={5}
                  step={5}
                  dir="ltr"
                  value={durationMin}
                  onChange={(e) => onDurationChange(Number(e.target.value) || 60)}
                  className="h-11 max-w-[5.5rem] bg-white text-center text-base font-semibold"
                />
                <span className="text-sm text-gray">دقیقه</span>
              </div>
            </div>
            {onSaveDuration && (
              <Button
                size="sm"
                variant="outline"
                className="h-11 shrink-0"
                disabled={busy}
                onClick={() => void onSaveDuration()}
              >
                ذخیره مدت
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="border-b border-border bg-[#FFE6E2]/40 px-4 py-3">
        <p className="mb-2 text-sm font-semibold text-navy">قیمت یکسان روی موارد انتخاب‌شده</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="relative flex-1">
            <Input
              className="h-11 bg-white pe-12 text-base"
              inputMode="numeric"
              placeholder={minPrice.toLocaleString('fa-IR')}
              value={batchPrice}
              onChange={(e) => setBatchPrice(e.target.value)}
              dir="ltr"
            />
            <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-xs text-gray">
              تومان
            </span>
          </div>
          <Button
            className="h-11 w-full sm:w-auto sm:min-w-[9rem]"
            disabled={busy || selected.size === 0 || parsePrice(batchPrice) < minPrice}
            onClick={() => void applyBatch()}
          >
            اعمال ({selected.size.toLocaleString('fa-IR')})
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-gray">
          ردیف‌ها را تیک بزنید → قیمت بنویسید → اعمال. یا برای هر ردیف جداگانه ذخیره کنید.
        </p>
      </div>

      <ul className="divide-y divide-border">
        {cells.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-gray">ردیف قیمتی نیست</li>
        )}
        {cells.map((c) => {
          const val = drafts[c.label] ?? (c.price > 0 ? String(c.price) : '');
          const saved = c.price >= minPrice;
          const isOn = selected.has(c.label);
          return (
            <li
              key={c.label}
              className={`px-4 py-3.5 transition ${isOn ? 'bg-[#FFE6E2]/35' : 'bg-white'}`}
            >
              <div className="mb-2.5 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  className="h-4.5 w-4.5 shrink-0 accent-[#fc7074]"
                  checked={isOn}
                  onChange={() => toggle(c.label)}
                  aria-label={c.label}
                />
                <span className="min-w-0 flex-1 text-sm font-semibold text-navy">{c.label}</span>
                {saved ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                    {c.price.toLocaleString('fa-IR')} ت
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] text-amber-700">
                    بدون قیمت
                  </span>
                )}
              </div>
              <div className="flex gap-2 ps-6">
                <div className="relative flex-1">
                  <Input
                    className="h-11 bg-gray-50 pe-12 text-base focus:bg-white"
                    inputMode="numeric"
                    dir="ltr"
                    value={val}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.label]: e.target.value }))}
                    placeholder={String(minPrice)}
                  />
                  <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-xs text-gray">
                    ت
                  </span>
                </div>
                <Button
                  size="sm"
                  className="h-11 shrink-0 px-5"
                  variant={saved ? 'outline' : 'primary'}
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
  );
}
