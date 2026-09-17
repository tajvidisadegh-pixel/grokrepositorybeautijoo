'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatDate } from '@/lib/utils';

type ReviewItem = {
  id: string;
  rating: number;
  comment?: string | null;
  isPublished: boolean;
  createdAt: string;
  customer?: { phone?: string | null; profile?: { displayName?: string | null } | null } | null;
  professional?: { id?: string; title?: string | null; slug?: string | null } | null;
  booking?: { id?: string; startAt?: string } | null;
};

export default function AdminReviewsPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'published' | 'hidden'>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '50');
      if (filter === 'published') params.set('isPublished', 'true');
      if (filter === 'hidden') params.set('isPublished', 'false');
      if (search.trim()) params.set('search', search.trim());
      const res = await apiClient.get<{ items?: ReviewItem[] } | ReviewItem[]>(
        `/admin/reviews?${params.toString()}`,
      );
      const list = Array.isArray(res) ? res : res.items || [];
      setItems(list);
    } catch (e) {
      setItems([]);
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function setPublished(id: string, isPublished: boolean) {
    setBusyId(id);
    setMsg(null);
    try {
      await apiClient.patch(`/admin/reviews/${id}/publish`, { isPublished });
      setMsg(isPublished ? 'نظر منتشر شد.' : 'نظر مخفی شد.');
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('آیا از حذف این نظر مطمئن هستید؟')) return;
    setBusyId(id);
    setMsg(null);
    try {
      await apiClient.delete(`/admin/reviews/${id}`);
      setMsg('نظر حذف شد.');
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">نظرات و امتیازها</h1>
        <p className="mt-1 text-sm text-gray">تأیید، مخفی‌سازی یا حذف نظرات مشتریان</p>
      </div>

      {msg && (
        <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">{msg}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'همه'],
            ['published', 'منتشرشده'],
            ['hidden', 'مخفی'],
          ] as const
        ).map(([k, label]) => (
          <Button
            key={k}
            size="sm"
            variant={filter === k ? 'primary' : 'outline'}
            onClick={() => setFilter(k)}
          >
            {label}
          </Button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو..."
          className="rounded-xl border border-border px-3 py-1.5 text-sm"
        />
        <Button size="sm" variant="outline" onClick={load}>
          بروزرسانی
        </Button>
      </div>

      {items.length === 0 ? (
        <PanelEmpty title="نظری یافت نشد" description="با فیلتر فعلی نظری وجود ندارد." />
      ) : (
        <ul className="space-y-3">
          {items.map((r) => {
            const customerName =
              r.customer?.profile?.displayName || r.customer?.phone || 'مشتری';
            const proTitle = r.professional?.title || '—';
            return (
              <li key={r.id}>
                <Card className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {customerName}{' '}
                        <span className="text-xs font-normal text-gray">→ {proTitle}</span>
                      </p>
                      <p className="text-xs text-gray">
                        {formatDate(r.createdAt, { style: 'short', includeTime: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-coral">
                        {'★'.repeat(r.rating)}
                        {'☆'.repeat(Math.max(0, 5 - r.rating))}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.isPublished
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {r.isPublished ? 'منتشر' : 'مخفی'}
                      </span>
                    </div>
                  </div>
                  {r.comment && <p className="text-sm text-gray">{r.comment}</p>}
                  <div className="flex flex-wrap gap-2">
                    {r.isPublished ? (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={busyId === r.id}
                        onClick={() => setPublished(r.id, false)}
                      >
                        مخفی کردن
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === r.id}
                        onClick={() => setPublished(r.id, true)}
                      >
                        انتشار
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busyId === r.id}
                      onClick={() => remove(r.id)}
                    >
                      حذف
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
