'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addJalaliMonths,
  buildJalaliMonthGrid,
  isoToJalaliLabel,
  jalaliMonthName,
  PERSIAN_WEEKDAYS,
  tehranTodayIso,
  toJalali,
} from '@/lib/jalali';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (isoYmd: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
};

function parseIsoParts(iso: string): { y: number; m: number; d: number } | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

/**
 * Shamsi date picker. Value is always Gregorian ISO YYYY-MM-DD (API-friendly).
 * Display and selection are Jalali only — issue #29.
 */
export function JalaliDateInput({
  value,
  onChange,
  min,
  max,
  disabled,
  className,
  id,
  name,
}: Props) {
  const today = tehranTodayIso();
  const effective = value || today;
  const parts = parseIsoParts(effective) || parseIsoParts(today)!;
  const j0 = toJalali(parts.y, parts.m, parts.d);

  const [open, setOpen] = useState(false);
  const [viewJy, setViewJy] = useState(j0.jy);
  const [viewJm, setViewJm] = useState(j0.jm);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const p = parseIsoParts(value || today);
    if (p) {
      const j = toJalali(p.y, p.m, p.d);
      setViewJy(j.jy);
      setViewJm(j.jm);
    }
  }, [open, value, today]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const grid = useMemo(() => buildJalaliMonthGrid(viewJy, viewJm), [viewJy, viewJm]);

  const label = value ? isoToJalaliLabel(value) : 'انتخاب تاریخ';

  const isDisabledDay = (iso: string) => {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {name && <input type="hidden" name={name} value={value || ''} />}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:cursor-not-allowed disabled:bg-gray-light',
          !value && 'text-gray-muted',
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{label}</span>
        <span className="text-xs text-gray" aria-hidden>
          📅
        </span>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-2 w-[min(100%,20rem)] rounded-2xl border border-border bg-white p-3 shadow-lg"
          role="dialog"
          aria-label="تقویم شمسی"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-xl px-2 py-1 text-sm text-coral hover:bg-coral-soft"
              onClick={() => {
                const n = addJalaliMonths(viewJy, viewJm, -1);
                setViewJy(n.jy);
                setViewJm(n.jm);
              }}
              aria-label="ماه قبل"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-blue">
              {jalaliMonthName(viewJm)} {viewJy.toLocaleString('fa-IR')}
            </span>
            <button
              type="button"
              className="rounded-xl px-2 py-1 text-sm text-coral hover:bg-coral-soft"
              onClick={() => {
                const n = addJalaliMonths(viewJy, viewJm, 1);
                setViewJy(n.jy);
                setViewJm(n.jm);
              }}
              aria-label="ماه بعد"
            >
              ›
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] text-gray">
            {PERSIAN_WEEKDAYS.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((cell) => {
              const selected = value === cell.iso;
              const isToday = cell.iso === today;
              const blocked = isDisabledDay(cell.iso);
              return (
                <button
                  key={cell.iso + String(cell.inMonth)}
                  type="button"
                  disabled={blocked || !cell.inMonth}
                  onClick={() => {
                    if (blocked || !cell.inMonth) return;
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                  className={cn(
                    'aspect-square rounded-lg text-sm transition',
                    !cell.inMonth && 'invisible',
                    cell.inMonth && !blocked && 'hover:bg-coral-soft',
                    blocked && 'cursor-not-allowed text-gray-muted opacity-40',
                    selected && 'bg-coral font-medium text-white hover:bg-coral',
                    isToday && !selected && 'ring-1 ring-coral/50',
                  )}
                >
                  {cell.jd.toLocaleString('fa-IR')}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex justify-between border-t border-border/60 pt-2">
            <button
              type="button"
              className="text-xs text-coral hover:underline"
              onClick={() => {
                if (!isDisabledDay(today)) {
                  onChange(today);
                  setOpen(false);
                }
              }}
            >
              امروز
            </button>
            <button
              type="button"
              className="text-xs text-gray hover:underline"
              onClick={() => setOpen(false)}
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Uncontrolled-friendly field for server-rendered forms (GET search, etc.) */
export function FormJalaliDate({
  name,
  defaultValue = '',
  min,
  max,
  className,
}: {
  name: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <JalaliDateInput
      name={name}
      value={value}
      onChange={setValue}
      min={min}
      max={max}
      className={className}
    />
  );
}
