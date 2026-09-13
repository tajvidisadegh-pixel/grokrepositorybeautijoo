'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { fetchNotifications, markNotificationRead, type NotificationItem } from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatDateTime } from '@/lib/utils';

function emitUnreadChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('beautijoo:unread-changed'));
  }
}

export default function PanelNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function onRead(id: string) {
    setBusyId(id);
    try {
      await markNotificationRead(id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      emitUnreadChanged();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">اعلان‌ها</h1>
        <p className="mt-1 text-sm text-gray">اعلان‌های واقعی از سرور</p>
      </div>
      {items.length === 0 ? (
        <PanelEmpty title="اعلانی نیست" />
      ) : (
        <ul className="space-y-3">
          {items.map((n) => {
            const unread = !n.readAt;
            return (
              <li key={n.id}>
                <Card className={`space-y-2 ${unread ? 'border-coral/40 bg-coral-soft/30' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{n.title || n.type || 'اعلان'}</p>
                        {unread && (
                          <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">
                            جدید
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray">{n.body || n.message || '—'}</p>
                      <p className="mt-1 text-xs text-gray">{formatDateTime(n.createdAt)}</p>
                    </div>
                    {unread && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={busyId === n.id}
                        onClick={() => onRead(n.id)}
                      >
                        خواندم
                      </Button>
                    )}
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
