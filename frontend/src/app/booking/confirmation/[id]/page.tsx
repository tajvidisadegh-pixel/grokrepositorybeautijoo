'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getBooking, initiatePayment, persianBookingStatus } from '@/lib/booking-api';
import { persianPaymentStatus } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice, formatDate } from '@/lib/utils';
import { AddToCalendarActions } from '@/components/booking/add-to-calendar';
import { Card } from '@/components/ui/card';
import { RequireAuth } from '@/components/auth/require-auth';
import type { BookingRecord } from '@/types/booking';

function ConfirmationBody() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params?.id || '');
  const { isAuthenticated } = useAuth();
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payMsg, setPayMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const b = await getBooking(id);
        if (!cancelled) setBooking(b);
      } catch (e) {
        if (!cancelled) setError(friendlyApiError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated]);

  async function onPay() {
    if (!booking) return;
    setPaying(true);
    setPayMsg(null);
    setError(null);
    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const callbackUrl = `${origin}/payment/callback`;
      const result = await initiatePayment(booking.id, callbackUrl);
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      setPayMsg('لینک درگاه دریافت نشد — دوباره تلاش کنید');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-gray">در حال بارگذاری...</div>
    );
  }

  if (error && !booking) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-red-700">{error}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-coral underline">
          بازگشت
        </Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="py-16 text-center text-gray">رزرو یافت نشد</div>
    );
  }

  const proName =
    booking.professional?.user?.profile?.displayName ||
    booking.professional?.title ||
    'زیباگر';
  const canPay =
    !booking.payment ||
    booking.payment.status === 'pending' ||
    booking.payment.status === 'failed';
  const payHint = searchParams.get('paid');
  const payQ = (searchParams.get('pay') || '').toLowerCase();
  const payOk = payHint === '1' || payQ === 'paid' || payQ === 'success' || payQ === 'ok';
  const payFail = payQ === 'failed' || payQ === 'cancelled' || payQ === 'canceled' || payQ === 'error' || payQ === 'unpaid';

  return (
    <div className="mx-auto max-w-lg px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-foreground">تأیید رزرو</h1>
      <p className="mt-1 text-sm text-gray">
        وضعیت: {persianBookingStatus(booking.status)}
      </p>
      {payOk && (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-bold">پرداخت با موفقیت ثبت شد</p>
          <p className="mt-1 text-xs">وضعیت رزرو را اینجا یا از «رزروهای من» ببینید.</p>
          <a href="/panel/bookings" className="mt-2 inline-block text-xs font-medium text-coral underline">مشاهده رزروهای من</a>
        </div>
      )}
      {payFail && (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-bold">پرداخت کامل نشد</p>
          <p className="mt-1 text-xs">می‌توانید دوباره پرداخت کنید یا بعداً از رزروهای من اقدام کنید.</p>
        </div>
      )}
      {payMsg && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{payMsg}</p>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Card className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-gray">زیباگر</span>
          <span>{proName}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-gray">شروع</span>
          <span>{formatDate(booking.startAt, { style: 'long', includeTime: true })}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-gray">مبلغ</span>
          <span className="font-bold text-coral">{formatPrice(booking.price)}</span>
        </div>
        {booking.payment && (
          <div className="flex justify-between gap-2">
            <span className="text-gray">پرداخت</span>
            <span>{persianPaymentStatus(booking.payment.status)}</span>
          </div>
        )}
      </Card>

      <div className="mt-4 space-y-3">
        <AddToCalendarActions booking={booking} />
        {canPay && (
          <button
            type="button"
            disabled={paying}
            onClick={onPay}
            className="flex h-11 w-full items-center justify-center rounded-2xl bg-coral text-sm font-medium text-white disabled:opacity-60"
          >
            {paying ? 'در حال اتصال به درگاه…' : 'پرداخت آنلاین'}
          </button>
        )}
        <Link
          href="/panel/bookings"
          className="flex h-11 w-full items-center justify-center rounded-2xl border border-border text-sm"
        >
          رزروهای من
        </Link>
      </div>
    </div>
  );
}

export default function BookingConfirmationPage() {
  return (
    <RequireAuth>
      <ConfirmationBody />
    </RequireAuth>
  );
}
