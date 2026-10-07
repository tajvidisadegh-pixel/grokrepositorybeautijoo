'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const KEY = 'bj_recent_searches_v1';
const MAX = 6;

export type RecentSearchItem = {
  q?: string;
  city?: string;
  label: string;
  href: string;
  at: number;
};

function read(): RecentSearchItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentSearchItem[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecentSearch(item: Omit<RecentSearchItem, 'at'>) {
  try {
    const prev = read().filter((x) => x.href !== item.href);
    const next = [{ ...item, at: Date.now() }, ...prev].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function RecentSearches() {
  const [items, setItems] = useState<RecentSearchItem[]>([]);

  useEffect(() => {
    setItems(read());
  }, []);

  if (!items.length) return null;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray">جستجوهای اخیر</p>
        <button
          type="button"
          className="text-[11px] text-gray-muted hover:text-coral"
          onClick={() => {
            try {
              localStorage.removeItem(KEY);
            } catch {
              /* ignore */
            }
            setItems([]);
          }}
        >
          پاک کردن
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <Link
            key={it.href + String(it.at)}
            href={it.href}
            className="rounded-full border border-border bg-white px-3 py-1 text-xs text-foreground transition-colors hover:border-coral/40 hover:text-coral"
          >
            {it.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Client side-effect: record current search params into recent list */
export function RecordRecentSearch({
  q,
  city,
  href,
}: {
  q?: string;
  city?: string;
  href: string;
}) {
  useEffect(() => {
    const labelParts = [q?.trim(), city?.trim()].filter(Boolean) as string[];
    if (!labelParts.length) return;
    pushRecentSearch({
      q: q?.trim() || undefined,
      city: city?.trim() || undefined,
      label: labelParts.join(' · '),
      href,
    });
  }, [q, city, href]);
  return null;
}
