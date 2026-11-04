'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchMyPriceQuotes,
  cancelPriceQuote,
  type PriceQuoteRequest,
} from '@/lib/panel-api';
import { formatPrice } from '@/lib/utils';
import { friendlyApiError } from '@/lib/api-errors';

const STATUS_FA: Record<string, string> = {
  pending: 'در انتظار پاسخ',
  quoted: 'قیمت اعلام شد',
  declined: 'رد شده',
  cancelled: 'لغو شده',
  expired: 'منقضی',
};

export default function CustomerQuotesPage() {
  const [items, setItems] = useState<PriceQuoteRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchMyPriceQuotes();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(friendlyApiError(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCancel(id: string) {
    if (!confirm('این درخواست لغو شود؟')) return;
    setBusyId(id);
    setError(null);
    try {
      await cancelPriceQuote(id);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4" dir="rtl">
      <div>
        <h1 className="text-lg font-bold text-navy">درخواست‌های قیمت من</h1>
        <p className="mt-1 text-sm text-gray">
          پاسخ زیباگر فقط پیشنهاد قیمت است و به‌معنای رزرو قطعی نیست. برای نوبت باید جداگانه رزرو کنید.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-white px-4 py-8 text-center">
          <p className="text-sm text-gray">هنوز درخواست قیمتی ثبت نکرده‌اید.</p>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((q) => {
          const proName =
            (q.professional as { title?: string; displayName?: string } | undefined)?.title ||
            q.professional?.displayName ||
            'زیباگر';
          const serviceName = q.professionalService?.service?.name || 'خدمت';
          const statusLabel = STATUS_FA[q.status] || q.status;
          const photos = Array.isArray(q.photoUrls) ? q.photoUrls : [];

          return (
            <li
              key={q.id}
              className="rounded-2xl border border-border bg-white p-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-navy">{serviceName}</p>
                  <p className="mt-0.5 text-xs text-gray">
                    {proName}
                    {q.professional?.slug && (
                      <>
                        {' · '}
                        <Link
                          href={`/p/${q.professional.slug}`}
                          className="text-coral underline"
                        >
                          پروفایل
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    q.status === 'quoted'
                      ? 'bg-emerald-50 text-emerald-800'
                      : q.status === 'pending'
                        ? 'bg-amber-50 text-amber-900'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {statusLabel}
                </span>
              </div>

              {q.note && <p className="mt-2 text-sm text-gray">{q.note}</p>}

              {photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {photos.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={u}
                      src={u}
                      alt=""
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}

              {q.status === 'quoted' && q.quotedPrice != null && (
                <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm">
                  <p className="font-bold text-emerald-900">
                    قیمت پیشنهادی: {formatPrice(q.quotedPrice)}
                  </p>
                  {q.quotedDurationMin != null && (
                    <p className="mt-0.5 text-xs text-emerald-800">
                      مدت تقریبی: {q.quotedDurationMin} دقیقه
                    </p>
                  )}
                  {q.responseNote && (
                    <p className="mt-1 text-xs text-emerald-900">{q.responseNote}</p>
                  )}
                  {q.professional?.slug && (
                    <Link
                      href={`/booking/${q.professional.slug}`}
                      className="mt-2 inline-block text-xs font-medium text-coral underline"
                    >
                      رفتن به رزرو
                    </Link>
                  )}
                </div>
              )}

              {q.status === 'declined' && (
                <p className="mt-2 text-xs text-gray">
                  {q.responseNote || 'زیباگر این درخواست را نپذیرفت.'}
                </p>
              )}

              {q.status === 'pending' && (
                <button
                  type="button"
                  disabled={busyId === q.id}
                  onClick={() => void onCancel(q.id)}
                  className="mt-3 rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-navy disabled:opacity-50"
                >
                  لغو درخواست
                </button>
              )}

              <p className="mt-2 text-[10px] text-gray" dir="ltr">
                {new Date(q.createdAt).toLocaleString('fa-IR')}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
