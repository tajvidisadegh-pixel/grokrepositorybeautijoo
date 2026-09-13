'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { fetchNotifications, markNotificationRead, type NotificationItem } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { cn, formatDateTime } from '@/lib/utils';

function emitUnreadChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('beautijoo:unread-changed'));
  }
}

export default function PanelNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems((await fetchNotifications(1)).items);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markReadIfNeeded(n: NotificationItem) {
    if (n.readAt || markingId === n.id) return;
    setMarkingId(n.id);
    try {
      await markNotificationRead(n.id);
      setItems((prev) =>
        prev.map((row) =>
          row.id === n.id ? { ...row, readAt: new Date().toISOString() } : row,
        ),
      );
      emitUnreadChanged();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setMarkingId(null);
    }
  }

  function handleOpen(n: NotificationItem) {
    const nextOpen = openId === n.id ? null : n.id;
    setOpenId(nextOpen);
    if (nextOpen === n.id) {
      void markReadIfNeeded(n);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">اعلان‌ها</h1>
        <p className="mt-1 text-sm text-gray">
          روی هر پیام بزنید تا باز شود و به‌عنوان خوانده‌شده ثبت شود
        </p>
      </div>
      {items.length === 0 ? (
        <PanelEmpty title="اعلانی نیست" />
      ) : (
        <ul className="space-y-3">
          {items.map((n) => {
            const unread = !n.readAt;
            const isOpen = openId === n.id;
            const body = n.body || n.message || '—';
            return (
              <li key={n.id}>
                <Card
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => handleOpen(n)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpen(n);
                    }
                  }}
                  className={cn(
                    'cursor-pointer space-y-2 transition hover:shadow-md',
                    unread && 'border-coral/40 bg-coral-soft/30',
                    isOpen && 'ring-2 ring-coral/30',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{n.title || n.type || 'اعلان'}</p>
                        {unread && (
                          <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">
                            جدید
                          </span>
                        )}
                        {markingId === n.id && (
                          <span className="text-[10px] text-gray">در حال ثبت...</span>
                        )}
                      </div>
                      <p
                        className={cn(
                          'mt-1 text-sm text-gray',
                          !isOpen && 'line-clamp-2',
                        )}
                      >
                        {body}
                      </p>
                      <p className="mt-1 text-xs text-gray">{formatDateTime(n.createdAt)}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray">
                      {isOpen ? 'بستن' : 'باز کردن'}
                    </span>
                  </div>
                  {isOpen && (
                    <div className="border-t border-border/60 pt-3 text-sm leading-relaxed text-foreground">
                      {body}
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
