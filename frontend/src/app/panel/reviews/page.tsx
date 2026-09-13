'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatDate } from '@/lib/utils';

type MyReview = {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  isPublished?: boolean;
  professional?: {
    id: string;
    slug?: string;
    title?: string | null;
    user?: { profile?: { displayName?: string | null } | null } | null;
  } | null;
  booking?: { id: string; startAt?: string; status?: string } | null;
};

export default function PanelReviewsPage() {
  const [items, setItems] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ items: MyReview[] } | MyReview[]>('/reviews/mine');
      const list = Array.isArray(res) ? res : res.items || [];
      setItems(list);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">نظرات من</h1>
        <p className="mt-1 text-sm text-gray">نظرهایی که برای زیباگرها ثبت کرده‌اید</p>
      </div>

      {items.length === 0 ? (
        <Card className="space-y-3 p-6">
          <PanelEmpty title="هنوز نظری ثبت نکرده‌اید" />
          <p className="text-center text-sm text-gray">
            پس از تکمیل رزرو می‌توانید از صفحه رزروها نظر ثبت کنید.
          </p>
          <div className="flex justify-center">
            <Link href="/panel/bookings">
              <Button size="sm">رفتن به رزروها</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => {
            const proName =
              r.professional?.user?.profile?.displayName ||
              r.professional?.title ||
              'زیباگر';
            return (
              <li key={r.id}>
                <Card className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{proName}</p>
                      <p className="text-xs text-gray">{formatDate(r.createdAt, { style: 'short', includeTime: true })}</p>
                    </div>
                    <span className="text-sm text-coral" aria-label={`امتیاز ${r.rating}`}>
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                    </span>
                  </div>
                  {r.comment && <p className="text-sm text-gray-800">{r.comment}</p>}
                  {r.booking?.startAt && (
                    <p className="text-xs text-gray">
                      رزرو مرتبط: {formatDate(r.booking.startAt, { style: 'short', includeTime: true })}
                    </p>
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
