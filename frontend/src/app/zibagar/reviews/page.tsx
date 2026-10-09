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
  isPublished?: boolean;
  createdAt: string;
  customer?: { profile?: { displayName?: string | null } | null; phone?: string | null } | null;
};

export default function ZibagarReviewsPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
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
      const res = await apiClient.get<{ items?: ReviewItem[] } | ReviewItem[]>(
        '/professionals/me/reviews?page=1&limit=50',
      );
      const list = Array.isArray(res) ? res : res.items || [];
      setItems(list);
    } catch (e) {
      setItems([]);
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
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

  if (loading) return <PanelLoading label="در حال بارگذاری نظرات…" />;
  if (error) return <PanelError message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-4" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">نظرات</h1>
        <p className="mt-1 text-sm text-gray">بازخورد مشتریان و پاسخ شما</p>
      </div>
      {msg && (
        <p className="rounded-xl bg-gray-light px-3 py-2 text-sm text-foreground">{msg}</p>
      )}
      {items.length === 0 ? (
        <PanelEmpty title="نظری ثبت نشده" description="پس از تکمیل نوبت‌ها، نظرات اینجا نمایش داده می‌شوند." />
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id}>
              <Card className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {r.customer?.profile?.displayName || r.customer?.phone || 'مشتری'}
                  </span>
                  <span className="text-xs text-gray">{formatDate(r.createdAt)}</span>
                </div>
                <div className="text-sm text-amber-600">
                  {'★'.repeat(Math.max(0, Math.min(5, r.rating || 0)))}
                  <span className="ms-1 text-gray">{r.rating?.toLocaleString('fa-IR')}</span>
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
                        <div className="mb-2 flex flex-wrap gap-1">
                          <span className="w-full text-[11px] text-gray">قالب پاسخ:</span>
                          {[
                            'از نظر شما سپاسگزاریم؛ خوشحالیم که راضی بودید.',
                            'ممنون از بازخوردتان؛ برای بهبود خدمات حتماً در نظر می‌گیریم.',
                            'از انتخاب شما متشکریم؛ منتظر دیدار دوباره هستیم.',
                          ].map((tpl) => (
                            <button
                              key={tpl.slice(0, 12)}
                              type="button"
                              className="rounded-full border border-border px-2 py-1 text-[11px] hover:border-coral"
                              onClick={() => setReplyText(tpl)}
                            >
                              {tpl.slice(0, 28)}…
                            </button>
                          ))}
                        </div>
                        <textarea
                          className="min-h-[72px] w-full rounded-xl border border-border px-3 py-2 text-sm"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="پاسخ محترمانه به مشتری..."
                          maxLength={2000}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" loading={busy} onClick={() => void submitReply(r.id)}>
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
          ))}
        </ul>
      )}
    </div>
  );
}
