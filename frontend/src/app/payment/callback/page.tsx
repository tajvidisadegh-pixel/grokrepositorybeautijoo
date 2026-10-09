'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { API_URL } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';

/**
 * Gateway return URL (Zarinpal sends Authority + Status).
 * Verifies via backend then redirects to booking confirmation.
 */
function PaymentCallbackBody() {
  const router = useRouter();
  const sp = useSearchParams();
  const [msg, setMsg] = useState('در حال تأیید پرداخت…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const authority = sp.get('Authority') || sp.get('authority') || sp.get('ref') || '';
    const status = sp.get('Status') || sp.get('status') || '';

    if (!authority) {
      setError('شناسه تراکنش از درگاه دریافت نشد');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams();
        qs.set('Authority', authority);
        if (status) qs.set('Status', status);
        const res = await fetch(`${API_URL}/payments/callback?${qs.toString()}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'include',
        });
        const text = await res.text();
        let data: { status?: string; bookingId?: string | null } = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          /* ignore */
        }
        if (cancelled) return;
        if (!res.ok) {
          setError(
            typeof data === 'object' && data && 'message' in data
              ? String((data as { message: unknown }).message)
              : 'تأیید پرداخت ناموفق بود',
          );
          return;
        }
        const bookingId = data.bookingId;
        if (bookingId) {
          setMsg(
            data.status === 'paid'
              ? 'پرداخت تأیید شد — در حال انتقال…'
              : 'وضعیت پرداخت ثبت شد — در حال انتقال…',
          );
          router.replace(`/booking/confirmation/${bookingId}?pay=${data.status || 'unknown'}`);
          return;
        }
        setMsg(`نتیجه: ${data.status || 'نامشخص'}`);
      } catch (e) {
        if (!cancelled) setError(friendlyApiError(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sp, router]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      {error ? (
        <div className="space-y-4 text-right" dir="rtl">
          <p className="text-lg font-bold text-red-700">پرداخت انجام نشد</p>
          <p className="text-sm text-red-800/90">{error}</p>
          <p className="text-xs text-gray">
            اگر مبلغ از حساب کسر شده، معمولاً تا ۷۲ ساعت برمی‌گردد. کد پیگیری درگاه را از پیامک بانک نگه دارید.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Link
              href="/panel/bookings"
              className="inline-flex h-11 items-center rounded-2xl bg-coral px-5 text-sm font-medium text-white"
            >
              رزروهای من / تلاش مجدد
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-2xl border border-border px-5 text-sm"
            >
              صفحه اصلی
            </Link>
          </div>
        </div>
      ) : (
        <p className="text-gray">{msg}</p>
      )}
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-gray">در حال بارگذاری…</div>}>
      <PaymentCallbackBody />
    </Suspense>
  );
}
