'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatDate } from '@/lib/utils';

type TicketListItem = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastPreview?: string | null;
  user?: { id: string; phone?: string | null; accountType?: string; displayName?: string | null } | null;
};

type TicketDetail = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  user?: { id: string; phone?: string | null; accountType?: string; profile?: { displayName?: string | null } | null } | null;
  messages: Array<{ id: string; body: string; isStaff: boolean; createdAt: string; sender?: { profile?: { displayName?: string | null } | null; phone?: string | null } | null }>;
};

const STATUS_LABEL: Record<string, string> = { open: 'باز', answered: 'پاسخ داده شده', closed: 'بسته' };

export default function AdminSupportPage() {
  const [items, setItems] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const q = statusFilter && statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const res = await apiClient.get<{ items?: TicketListItem[] }>(`/support/tickets/all?page=1${q}`);
      setItems(res.items || []);
    } catch (e) { setItems([]); setError(friendlyApiError(e)); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function openTicket(id: string) {
    setSelectedId(id); setDetail(null); setReply(''); setMsg(null);
    try { setDetail(await apiClient.get<TicketDetail>(`/support/tickets/${id}`)); }
    catch (e) { setMsg(friendlyApiError(e)); }
  }

  async function sendReply() {
    if (!selectedId || reply.trim().length < 1) return;
    setBusy(true); setMsg(null);
    try {
      await apiClient.post(`/support/tickets/${selectedId}/messages`, { body: reply.trim() });
      setReply(''); setMsg('پاسخ ارسال شد.'); await openTicket(selectedId); await load();
    } catch (e) { setMsg(friendlyApiError(e)); } finally { setBusy(false); }
  }

  async function changeStatus(status: string) {
    if (!selectedId) return;
    setBusy(true); setMsg(null);
    try {
      await apiClient.patch(`/support/tickets/${selectedId}/status`, { status });
      setMsg('وضعیت به‌روز شد.'); await openTicket(selectedId); await load();
    } catch (e) { setMsg(friendlyApiError(e)); } finally { setBusy(false); }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  if (selectedId && detail) {
    const userLabel = detail.user?.profile?.displayName || detail.user?.phone || detail.user?.id?.slice(0, 8) || '—';
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedId(null); setDetail(null); }}>← بازگشت به لیست</Button>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" loading={busy} onClick={() => changeStatus('open')}>باز</Button>
            <Button size="sm" variant="outline" loading={busy} onClick={() => changeStatus('answered')}>پاسخ‌داده‌شده</Button>
            <Button size="sm" variant="outline" loading={busy} onClick={() => changeStatus('closed')}>بستن</Button>
          </div>
        </div>
        <Card className="space-y-3">
          <h1 className="text-lg font-bold">{detail.subject}</h1>
          <p className="text-xs text-gray">کاربر: {userLabel} ({detail.user?.accountType || '—'}) · {STATUS_LABEL[detail.status] || detail.status} · {formatDate(detail.createdAt, { style: 'short', includeTime: true })}</p>
          <ul className="space-y-3">
            {detail.messages.map((m) => (
              <li key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.isStaff ? 'bg-coral/10 border border-coral/20' : 'bg-gray-light/60'}`}>
                <p className="text-xs font-medium text-gray mb-1">{m.isStaff ? 'پشتیبانی' : 'کاربر'} · {formatDate(m.createdAt, { style: 'short', includeTime: true })}</p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-border pt-3">
            <textarea className="min-h-[80px] w-full rounded-xl border border-border px-3 py-2 text-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="پاسخ پشتیبانی..." maxLength={4000} />
            <Button size="sm" loading={busy} onClick={sendReply}>ارسال پاسخ</Button>
          </div>
        </Card>
        {msg && <p className="text-sm text-coral">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">پشتیبانی</h1>
        <div className="flex gap-2">
          {['all', 'open', 'answered', 'closed'].map((s) => (
            <Button key={s} size="sm" variant={statusFilter === s ? 'primary' : 'outline'} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'همه' : STATUS_LABEL[s] || s}
            </Button>
          ))}
        </div>
      </div>
      {msg && <p className="text-sm text-coral">{msg}</p>}
      {items.length === 0 ? (
        <PanelEmpty title="تیکتی نیست" description="هنوز تیکتی ثبت نشده است." />
      ) : (
        <ul className="space-y-2">
          {items.map((t) => {
            const name = t.user?.displayName || t.user?.phone || '—';
            return (
              <li key={t.id}>
                <button type="button" className="w-full text-right" onClick={() => openTicket(t.id)}>
                  <Card className="hover:border-coral/40 transition-colors space-y-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold">{t.subject}</p>
                      <span className="text-xs text-gray">{STATUS_LABEL[t.status] || t.status}</span>
                    </div>
                    <p className="text-sm text-gray">{name} · {t.user?.accountType || ''}</p>
                    {t.lastPreview && <p className="text-sm text-gray line-clamp-1">{t.lastPreview}</p>}
                    <p className="text-xs text-gray">{formatDate(t.updatedAt, { style: 'short', includeTime: true })} · {t.messageCount} پیام</p>
                  </Card>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
