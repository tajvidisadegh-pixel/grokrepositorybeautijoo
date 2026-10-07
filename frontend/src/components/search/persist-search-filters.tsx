'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const KEY = 'beautijoo:lastSearchFilters';

export function PersistSearchFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  useEffect(() => {
    const keys = ['q', 'city', 'category', 'minRating', 'minPrice', 'maxPrice', 'sort', 'gender', 'verifiedOnly', 'availableToday', 'minDuration'];
    const hasAny = keys.some((k) => { const v = sp.get(k); return v != null && v !== ''; });
    if (hasAny) {
      const saved: Record<string, string> = {};
      keys.forEach((k) => { const v = sp.get(k); if (v) saved[k] = v; });
      try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {}
      return;
    }
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, string>;
      const params = new URLSearchParams();
      Object.entries(saved).forEach(([k, v]) => { if (v) params.set(k, v); });
      const qs = params.toString();
      if (qs) router.replace(`/search?${qs}`);
    } catch {}
  }, [sp, router]);
  return null;
}
