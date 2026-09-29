'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchMyBookings,
  createReview,
  transitionBooking,
  rescheduleBooking,
  type BookingListItem,
} from '@/lib/panel-api';
import { fetchAvailability } from '@/lib/booking-api';
import { persianBookingStatus, persianPaymentStatus } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice, formatRelativeDate } from '@/lib/utils';

type BookingWithReview = BookingListItem & {
  review?: { id?: string } | null;
  hasReview?: boolean;
  payment?: { id?: string; status?: string; amount?: number } | null;
};

/** Customer may cancel pending/confirmed if start is at least ~2h away (server enforces). */
function canCustomerCancel(b: BookingWithReview): boolean {
  if (b.status !== 'pending' && b.status !== 'confirmed') return false;
  const start = new Date(b.startAt).getTime();
  if (Number.isNaN(start)) return false;
  return start - Date.now() > 2 * 3600_000;
}

export default function PanelBookingsPage() {
  const [items, setItems] = useState<BookingWithReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const searchParams = useSearchParams();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<{ start: string }[]>([]);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMyBookings(1, 50);
      setItems(Array.isArray(res.items) ? (res.items as BookingWithReview[]) : []);
    } catch (e) {
      setItems([]);
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Deep link: /panel/bookings?review=<bookingId>
  useEffect(() => {
    const rid = searchParams.get('review');
    if (!rid || items.length === 0) return;
    const b = items.find((x) => x.id === rid);
    if (!b || b.status !== 'completed') return;
    if (reviewedIds.has(rid) || b.review || b.hasReview) return;
    setReviewFor(rid);
    setRating(5);
    setComment('');
  }, [searchParams, items, reviewedIds]);

  async function submitReview(bookingId: string) {
    setSubmitting(true);
    setReviewMsg(null);
    try {
      await createReview({ bookingId, rating, comment: comment.trim() || undefined });
      setReviewMsg('نظر شما با موفقیت ثبت شد. با تشکر!');
      setReviewedIds((prev) => new Set(prev).add(bookingId));
      setReviewFor(null);
      setComment('');
      setRating(5);
      await load();
    } catch (e) {
      setReviewMsg(friendlyApiError(e));
    } finally {
      setSubmitting(false);
    }
  }


  async function loadRescheduleSlots(b: BookingWithReview, date: string) {
    if (!date || !b.professional?.id) return;
    setRescheduleLoading(true);
    try {
      const start = b.startAt ? new Date(b.startAt).getTime() : 0;
      const end = b.endAt ? new Date(b.endAt).getTime() : start + 30 * 60_000;
      const durationMin = Math.max(15, Math.round((end - start) / 60_000) || 30);
      const avail = await fetchAvailability(b.professional.id, date, durationMin);
      setRescheduleSlots(Array.isArray(avail?.slots) ? avail.slots : []);
    } catch {
      setRescheduleSlots([]);
    } finally {
      setRescheduleLoading(false);
    }
  }

  async function applyReschedule(b: BookingWithReview, slotStart: string) {
    if (!rescheduleDate) return;
    setRescheduleLoading(true);
    setActionMsg(null);
    try {
      const hh = slotStart.length === 5 ? slotStart + ':00' : slotStart;
      const startAt = `${rescheduleDate}T${hh}.000Z`;
      await rescheduleBooking(b.id, startAt);
      setActionMsg('زمان رزرو با موفقیت تغییر کرد.');
      setRescheduleFor(null);
      setRescheduleSlots([]);
      await load();
    } catch (e) {
      setActionMsg(friendlyApiError(e));
    } finally {
      setRescheduleLoading(false);
    }
  }

  async function handleCancel(b: BookingWithReview) {
    const paid = b.payment?.status === 'paid';
    const msg = paid
      ? 'آیا از لغو این رزرو مطمئن هستید؟ در صورت پرداخت موفق، درخواست استرداد ثبت می‌شود.'
      : 'آیا از لغو این رزرو مطمئن هستید؟';
    if (typeof window !== 'undefined' && !window.confirm(msg)) return;
    setCancellingId(b.id);
    setActionMsg(null);
    try {
      const reason =
        (typeof window !== 'undefined'
          ? window.prompt('دلیل لغو (اختیاری):')
          : null) || 'لغو توسط مشتری';
      await transitionBooking(b.id, 'cancel', reason.trim() || 'لغو توسط مشتری');
      setActionMsg(
        paid
          ? 'رزرو لغو شد. در صورت پرداخت موفق، استرداد در حال پردازش است.'
          : 'رزرو با موفقیت لغو شد.',
      );
      await load();
    } catch (e) {
      setActionMsg(friendlyApiError(e));
    } finally {
      setCancellingId(null);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">رزروهای من</h1>
        <p className="mt-1 text-sm text-gray">لیست واقعی از سرور</p>
      </div>
      {(() => {
        const pending = items.filter(
          (b) =>
            b.status === 'completed' &&
            !reviewedIds.has(b.id) &&
            !b.review &&
            !b.hasReview,
        );
        if (pending.length === 0) return null;
        return (
          <div className="rounded-2xl border border-coral/30 bg-coral-soft px-4 py-3 text-sm">
            <p className="font-medium text-coral">
              {pending.length.toLocaleString('fa-IR')} نوبت منتظر نظر شماست
            </p>
            <p className="mt-1 text-xs text-gray">
              ثبت نظر به دیگران کمک می‌کند زیباگر مناسب را پیدا کنند.
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-coral underline"
              onClick={() => {
                setReviewFor(pending[0].id);
                setRating(5);
                setComment('');
              }}
            >
              ثبت نظر برای اولین مورد
            </button>
          </div>
        );
      })()}

      {reviewMsg && (
        <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">{reviewMsg}</p>
      )}
      {actionMsg && (
        <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">{actionMsg}</p>
      )}
      {items.length === 0 ? (
        <PanelEmpty
          title="رزروی یافت نشد"
          description="هنوز نوبتی رزرو نکرده‌اید."
          action={
            <Link href="/professionals">
              <Button size="sm">جستجوی زیباگر</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((b) => {
            const proName =
              b.professional?.user?.profile?.displayName ||
              b.professional?.title ||
              'زیباگر';
            const alreadyReviewed =
              reviewedIds.has(b.id) || !!b.review || !!b.hasReview;
            const payStatus = b.payment?.status;
            const showCancel = canCustomerCancel(b);
            return (
              <li key={b.id}>
                <Card className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{proName}</p>
                      <p className="text-xs text-gray">
                        {formatRelativeDate(b.startAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-coral-soft px-3 py-1 text-xs font-medium text-coral">
                        {persianBookingStatus(b.status)}
                      </span>
                      {payStatus && (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            payStatus === 'refunded'
                              ? 'bg-green-100 text-green-800'
                              : payStatus === 'paid'
                                ? 'bg-blue-100 text-blue-800'
                                : payStatus === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          پرداخت: {persianPaymentStatus(payStatus)}
                        </span>
                      )}
                    </div>
                  </div>
                  {b.totalPrice != null && (
                    <p className="text-sm text-gray">{formatPrice(b.totalPrice)}</p>
                  )}
                  {b.status === 'cancelled' && payStatus === 'refunded' && (
                    <p className="text-xs text-green-700">مبلغ این رزرو مسترد شده است.</p>
                  )}
                  {b.status === 'cancelled' && payStatus === 'paid' && (
                    <p className="text-xs text-amber-700">
                      رزرو لغو شده؛ استرداد هنوز نهایی نشده (در صورت نیاز با پشتیبانی تماس بگیرید).
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/booking/confirmation/${b.id}`}>
                      <Button size="sm" variant="outline">
                        جزئیات
                      </Button>
                    </Link>
                    {showCancel && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={cancellingId === b.id}
                        onClick={() => handleCancel(b)}
                      >
                        {payStatus === 'paid' ? 'لغو و درخواست بازپرداخت' : 'لغو رزرو'}
                      </Button>
                    )}
                    {b.status === 'completed' && !alreadyReviewed && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setReviewFor(b.id);
                          setRating(5);
                          setComment('');
                        }}
                      >
                        ⭐ ثبت امتیاز و نظر
                      </Button>
                    )}
                    {b.status === 'completed' && alreadyReviewed && (
                      <span className="self-center text-xs text-gray">نظر ثبت شده</span>
                    )}
                  </div>
                  
                  {rescheduleFor === b.id && (
                    <div className="mt-3 space-y-2 rounded-2xl border border-border bg-gray-light/40 p-3">
                      <p className="text-sm font-medium">انتخاب زمان جدید</p>
                      <input
                        type="date"
                        className="h-10 w-full rounded-xl border border-border px-3 text-sm"
                        value={rescheduleDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => {
                          const d = e.target.value;
                          setRescheduleDate(d);
                          void loadRescheduleSlots(b, d);
                        }}
                      />
                      {rescheduleLoading && <p className="text-xs text-gray">در حال بارگذاری ساعات…</p>}
                      {!rescheduleLoading && rescheduleDate && rescheduleSlots.length === 0 && (
                        <p className="text-xs text-gray">ساعت آزادی برای این روز نیست.</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {rescheduleSlots.map((sl) => (
                          <button
                            key={sl.start}
                            type="button"
                            disabled={rescheduleLoading}
                            className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs hover:border-coral hover:text-coral"
                            onClick={() => void applyReschedule(b, sl.start)}
                          >
                            {sl.start}
                          </button>
                        ))}
                      </div>
                      <button type="button" className="text-xs text-gray underline" onClick={() => setRescheduleFor(null)}>
                        انصراف
                      </button>
                    </div>
                  )}

                  
                  {rescheduleFor === b.id && (
                    <div className="mt-3 space-y-2 rounded-2xl border border-border bg-gray-light/40 p-3">
                      <p className="text-sm font-medium">انتخاب زمان جدید</p>
                      <input
                        type="date"
                        className="h-10 w-full rounded-xl border border-border px-3 text-sm"
                        value={rescheduleDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => {
                          const d = e.target.value;
                          setRescheduleDate(d);
                          void loadRescheduleSlots(b, d);
                        }}
                      />
                      {rescheduleLoading && <p className="text-xs text-gray">در حال بارگذاری ساعات…</p>}
                      {!rescheduleLoading && rescheduleDate && rescheduleSlots.length === 0 && (
                        <p className="text-xs text-gray">ساعت آزادی برای این روز نیست.</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {rescheduleSlots.map((sl) => (
                          <button
                            key={sl.start}
                            type="button"
                            disabled={rescheduleLoading}
                            className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs hover:border-coral hover:text-coral"
                            onClick={() => void applyReschedule(b, sl.start)}
                          >
                            {sl.start}
                          </button>
                        ))}
                      </div>
                      <button type="button" className="text-xs text-gray underline" onClick={() => setRescheduleFor(null)}>
                        انصراف
                      </button>
                    </div>
                  )}

                  {reviewFor === b.id && (
                    <div className="mt-2 space-y-3 rounded-xl bg-gray-light p-3">
                      <div>
                        <label className="mb-1 block text-xs text-gray">امتیاز</label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setRating(n)}
                              className={`flex h-9 min-w-10 items-center justify-center gap-0.5 rounded-lg border px-1.5 text-sm font-semibold ${
                                n <= rating
                                  ? 'border-coral bg-coral text-white'
                                  : 'border-border bg-white text-gray'
                              }`}
                              aria-label={`${n} ستاره`}
                            >
                              <span className="text-base leading-none">★</span>
                              <span className="text-[11px] leading-none">{n}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={2}
                        placeholder="نظر شما (اختیاری)"
                        className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          loading={submitting}
                          onClick={() => submitReview(b.id)}
                        >
                          ارسال
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReviewFor(null)}
                        >
                          انصراف
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
