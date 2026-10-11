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
  onSaveCell: (label: string, price: number, ruleId?: string) => Promise<void>;
  onBatchApply: (labels: string[], price: number) => Promise<void>;
};

/** جدول قیمت + اعمال دسته‌ای — مطابق طرح #60 */
export function PriceMatrix({ title, cells, busy, onSaveCell, onBatchApply }: Props) {
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

  async function applyBatch() {
    const price = Math.max(0, Math.round(Number(batchPrice.replace(/,/g, '')) || 0));
    if (!selected.size || price <= 0) return;
    await onBatchApply([...selected], price);
    setSelected(new Set());
    setBatchPrice('');
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-white p-3" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-[#0B2C4A]">{title}</h3>
        <button type="button" className="text-xs text-coral" onClick={toggleAll}>
          {selected.size === allLabels.length ? 'لغو انتخاب همه' : 'انتخاب همه'}
        </button>
      </div>

      <div className="rounded-xl border border-coral/30 bg-coral-soft/40 p-3 space-y-2">
        <p className="text-sm font-medium text-[#0B2C4A]">اعمال قیمت یکسان روی موارد انتخاب‌شده</p>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-[160px]"
            inputMode="numeric"
            placeholder="قیمت (تومان)"
            value={batchPrice}
            onChange={(e) => setBatchPrice(e.target.value)}
            dir="ltr"
          />
          <Button
            size="sm"
            disabled={busy || selected.size === 0 || !batchPrice}
            onClick={() => void applyBatch()}
          >
            اعمال روی {selected.size.toLocaleString('fa-IR')} مورد
          </Button>
        </div>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {cells.map((c) => {
          const val = drafts[c.label] ?? (c.price > 0 ? String(c.price) : '');
          return (
            <li key={c.label} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <input
                type="checkbox"
                checked={selected.has(c.label)}
                onChange={() => toggle(c.label)}
                aria-label={c.label}
              />
              <span className="min-w-[7rem] flex-1 text-sm font-medium">{c.label}</span>
              <Input
                className="w-28"
                inputMode="numeric"
                dir="ltr"
                value={val}
                onChange={(e) => setDrafts((d) => ({ ...d, [c.label]: e.target.value }))}
                placeholder="۰"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  const price = Math.max(0, Math.round(Number((drafts[c.label] ?? val).replace(/,/g, '')) || 0));
                  void onSaveCell(c.label, price, c.ruleId);
                }}
              >
                ذخیره
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
