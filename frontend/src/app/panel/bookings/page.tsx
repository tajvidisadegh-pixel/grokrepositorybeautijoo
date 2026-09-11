'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { fetchMyBookings, createReview, type BookingListItem } from '@/lib/panel-api';
import { persianBookingStatus } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';

export default function PanelBookingsPage() {
  const [items, setItems] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetchMyBookings(1, 50);
      setItems(Array.isArray(res.items) ? res.items : []);
    } catch (e) {
      // Soft-fail: show empty list + message instead of blocking whole panel
      setItems([]);
      setError(friendlyApiError(e));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function submitReview(bookingId: string) {
    setSubmitting(true); setReviewMsg(null);
    try {
      await createReview({ bookingId, rating, comment: comment.trim() || undefined });
      setReviewMsg('نظر شما ثبت شد.'); setReviewFor(null); setComment('');
    } catch (e) { setReviewMsg(friendlyApiError(e)); }
    finally { setSubmitting(false); }
  }
  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">رزروهای من</h1>
        <p className="mt-1 text-sm text-gray">لیست واقعی از سرور</p></div>
      {reviewMsg && <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">{reviewMsg}</p>}
      {items.length === 0 ? (
        <PanelEmpty title="رزروی یافت نشد" description="هنوز نوبتی رزرو نکرده‌اید."
          action={<Link href="/professionals"><Button size="sm">جستجوی زیباگر</Button></Link>} />
      ) : (
        <ul className="space-y-3">{items.map((b) => {
          const proName = b.professional?.user?.profile?.displayName || b.professional?.title || 'زیباگر';
          return (
            <li key={b.id}><Card className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold">{proName}</p>
                  <p className="text-xs text-gray" dir="ltr">{new Date(b.startAt).toLocaleString('fa-IR')}</p></div>
                <span className="rounded-full bg-coral-soft px-3 py-1 text-xs font-medium text-coral">{persianBookingStatus(b.status)}</span>
              </div>
              {b.totalPrice != null && <p className="text-sm text-gray">{formatPrice(b.totalPrice)}</p>}
              <div className="flex flex-wrap gap-2">
                <Link href={`/booking/confirmation/${b.id}`}><Button size="sm" variant="outline">جزئیات</Button></Link>
                {b.status === 'completed' && <Button size="sm" variant="secondary" onClick={() => setReviewFor(b.id)}>ثبت نظر</Button>}
              </div>
              {reviewFor === b.id && (
                <div className="mt-2 space-y-2 rounded-xl bg-gray-light p-3">
                  <label className="block text-xs text-gray">امتیاز (۱ تا ۵)</label>
                  <input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-20 rounded-xl border border-border px-2 py-1 text-sm" />
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="نظر شما (اختیاری)" className="w-full rounded-xl border border-border px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" loading={submitting} onClick={() => submitReview(b.id)}>ارسال</Button>
                    <Button size="sm" variant="outline" onClick={() => setReviewFor(null)}>انصراف</Button>
                  </div>
                </div>
              )}
            </Card></li>
          );
        })}</ul>
      )}
    </div>
  );
}
