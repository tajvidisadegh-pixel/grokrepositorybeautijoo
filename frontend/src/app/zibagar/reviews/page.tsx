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
  professionalReply?: string | null;
  repliedAt?: string | null;
  isPublished?: boolean;
  createdAt: string;
  customer?: { phone?: string | null; profile?: { displayName?: string | null } | null } | null;
  booking?: { id?: string; startAt?: string } | null;
};

export default function ZibagarReviewsPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<{ ratingAvg?: number | string; ratingCount?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{
        items?: ReviewItem[];
        summary?: { ratingAvg?: number | string; ratingCount?: number };
      }>(`/reviews/professional?page=1&limit=50`);
      setItems(res.items || []);
      setSummary(res.summary || null);
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

  async function submitReply(id: string) {
    const t = replyText.trim();
    if (t.length < 2) {
      setMsg('پاسخ حداقل ۲ کاراکتر باشد.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.patch(`/reviews/${id}/reply`, { reply: t });
      setMsg('پاسخ ثبت شد.');
      setReplyFor(null);
      setReplyText('');
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  const avg =
    summary?.ratingAvg != null ? Number(summary.ratingAvg).toFixed(1) : '—';
  const count = summary?.ratingCount ?? items.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">نظرات دریافتی</h1>
          <p className="mt-1 text-sm text-gray">بازخورد مشتریان و پاسخ شما</p>
        </div>
        <Card className="px-4 py-2 text-center">
          <p className="text-lg font-bold text-coral">{avg} ★</p>
          <p className="text-xs text-gray">{count} نظر</p>
        </Card>
      </div>

      <Button size="sm" variant="outline" onClick={load}>
        بروزرسانی
      </Button>
      {msg && <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">{msg}</p>}

      {items.length === 0 ? (
        <PanelEmpty title="هنوز نظری ثبت نشده" description="پس از تکمیل رزروها، نظرات اینجا نمایش داده می‌شوند." />
      ) : (
        <ul className="space-y-3">
          {items.map((r) => {
            const name =
              r.customer?.profile?.displayName || r.customer?.phone || 'مشتری';
            return (
              <li key={r.id}>
                <Card className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{name}</p>
                      <p className="text-xs text-gray">
                        {formatDate(r.createdAt, { style: 'short', includeTime: true })}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-coral">
                      {'★'.repeat(r.rating)}
                      {'☆'.repeat(Math.max(0, 5 - r.rating))}
                    </span>
                  </div>
                  {r.comment && <p className="text-sm text-gray">{r.comment}</p>}
                  {r.isPublished === false && (
                    <span className="text-xs text-gray">در انتظار انتشار توسط مدیریت</span>
                  )}
                  {r.professionalReply ? (
                    <div className="rounded-xl bg-gray-light/60 px-3 py-2 text-sm">
                      <p className="text-xs font-medium text-coral">پاسخ شما</p>
                      <p className="mt-1 text-gray">{r.professionalReply}</p>
                    </div>
                  ) : (
                    <div>
                      {replyFor === r.id ? (
                        <div className="space-y-2">
                          <textarea
                            className="min-h-[72px] w-full rounded-xl border border-border px-3 py-2 text-sm"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="پاسخ محترمانه به مشتری..."
                            maxLength={2000}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" loading={busy} onClick={() => submitReply(r.id)}>
                              ثبت پاسخ
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReplyFor(null);
                                setReplyText('');
                              }}
                            >
                              انصراف
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReplyFor(r.id);
                            setReplyText('');
                            setMsg(null);
                          }}
                        >
                          پاسخ به نظر
                        </Button>
                      )}
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
