'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchProPriceQuotes, respondPriceQuote, type PriceQuoteRequest } from '@/lib/panel-api';
import { formatPrice } from '@/lib/utils';
import { friendlyApiError } from '@/lib/api-errors';

export default function ZibagarQuotesPage() {
  const [items, setItems] = useState<PriceQuoteRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const rows = await fetchProPriceQuotes();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(friendlyApiError(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function respond(id: string, status: 'quoted' | 'declined') {
    setBusy(true);
    setError(null);
    try {
      const quotedPrice = status === 'quoted' ? Number(priceDraft[id] || 0) : undefined;
      await respondPriceQuote(id, { status, quotedPrice });
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4" dir="rtl">
      <h1 className="text-lg font-bold text-navy">درخواست‌های قیمت</h1>
      <p className="text-sm text-gray">کاربر می‌تواند با توضیح و عکس، قیمت تقریبی بپرسد. پاسخ شما رزرو قطعی نیست.</p>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {items.length === 0 && <p className="text-sm text-gray">درخواستی نیست.</p>}
      <ul className="space-y-3">
        {items.map((q) => (
          <li key={q.id} className="rounded-2xl border border-border bg-white p-3 shadow-sm">
            <p className="text-sm font-medium text-navy">
              {q.professionalService?.service?.name || 'خدمت'} · {q.status}
            </p>
            {q.note && <p className="mt-1 text-sm text-gray">{q.note}</p>}
            {Array.isArray(q.photoUrls) && q.photoUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {q.photoUrls.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ))}
              </div>
            )}
            {q.status === 'pending' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  className="w-32 rounded-lg border border-border px-2 py-1 text-sm"
                  placeholder="مبلغ (تومان)"
                  value={priceDraft[q.id] || ''}
                  onChange={(e) => setPriceDraft((p) => ({ ...p, [q.id]: e.target.value }))}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void respond(q.id, 'quoted')}
                  className="rounded-lg bg-coral px-3 py-1.5 text-xs text-white disabled:opacity-50"
                >
                  ارسال قیمت
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void respond(q.id, 'declined')}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs"
                >
                  رد
                </button>
              </div>
            )}
            {q.status === 'quoted' && q.quotedPrice != null && (
              <p className="mt-2 text-sm font-bold text-coral">{formatPrice(q.quotedPrice)}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
