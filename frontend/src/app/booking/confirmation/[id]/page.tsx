'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getBooking, persianBookingStatus } from '@/lib/booking-api';
import { persianPaymentStatus } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { RequireAuth } from '@/components/auth/require-auth';
import type { BookingRecord } from '@/types/booking';

function ConfirmationBody() {
  const params = useParams();
  const id = String(params?.id || '');
  const { isAuthenticated } = useAuth();
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="py-16 text-center text-gray">در حال بارگذاری...</div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-red-700">{error}</p>
        <Link href="/" className="mt-4 inline-block text-coral hover:underline">
          صفحه اصلی
        </Link>
      </div>
    );
  }

  if (!booking) return null;

  const proName =
    booking.professional?.user?.profile?.displayName ||
    booking.professional?.title ||
    'زیباگر';

  const payStatus = booking.payment?.status || '';
  const isPaid = payStatus === 'paid';
  const payFailed = payStatus === 'failed' || payStatus === 'cancelled';
  const awaitingPay = !isPaid && !payFailed;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold">
        {isPaid
          ? 'رزرو شما با موفقیت ثبت شد'
          : payFailed
            ? 'پرداخت انجام نشد'
            : 'بررسی و وضعیت رزرو'}
      </h1>
      {isPaid && (
        <p className="mt-2 text-sm text-emerald-700">
          پرداخت از سرور تأیید شده و رزرو شما نهایی است.
        </p>
      )}
      {payFailed && (
        <p className="mt-2 text-sm text-red-700">
          پرداخت انجام نشد و رزرو شما نهایی نشده است. در صورت نیاز دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.
        </p>
      )}
      {awaitingPay && (
        <p className="mt-2 text-sm text-amber-800">
          رزرو هنوز در انتظار پرداخت یا تأیید است. موفقیت فقط پس از تأیید سرور اعلام می‌شود.
        </p>
      )}
      <Card className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-gray">وضعیت رزرو</span>
          <span className="font-bold">
            {persianBookingStatus(booking.status)}
          </span>
        </div>
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
          <span className="font-bold text-coral">
            {formatPrice(booking.totalPrice)}
          </span>
        </div>
        {booking.items && booking.items.length > 0 && (
          <div>
            <p className="mb-1 text-gray">خدمات</p>
            <ul className="list-inside list-disc">
              {booking.items.map((it) => (
                <li key={it.id}>
                  {it.service?.name || 'خدمت'} — {formatPrice(it.price)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-between gap-2 border-t border-border pt-3">
          <span className="text-gray">وضعیت پرداخت</span>
          <span className="font-medium">
            {booking.payment
              ? persianPaymentStatus(booking.payment.status)
              : 'هنوز پرداختی از سرور تأیید نشده'}
          </span>
        </div>
      </Card>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/panel/bookings"
          className="inline-flex h-11 items-center rounded-2xl bg-coral px-5 text-sm font-medium text-white"
        >
          رزروهای من
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-2xl border border-border px-5 text-sm"
        >
          صفحه اصلی
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
