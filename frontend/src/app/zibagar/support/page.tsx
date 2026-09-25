'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
};

type TicketDetail = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  messages: Array<{
    id: string;
    body: string;
    isStaff: boolean;
    createdAt: string;
    sender?: { profile?: { displayName?: string | null } | null; phone?: string | null } | null;
  }>;
};

const STATUS_LABEL: Record<string, string> = {
  open: 'باز',
  answered: 'پاسخ داده شده',
  closed: 'بسته',
};

export default function ZibagarSupportPage() {
  const [items, setItems] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ items?: TicketListItem[] }>('/support/tickets?page=1');
      setItems(res.items || []);
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

  async function openTicket(id: string) {
    setSelectedId(id);
    setDetail(null);
    setReply('');
    setMsg(null);
    try {
      const d = await apiClient.get<TicketDetail>(`/support/tickets/${id}`);
      setDetail(d);
    } catch (e) {
      setMsg(friendlyApiError(e));
    }
  }

  async function createTicket() {
    const s = subject.trim();
    const b = body.trim();
    if (s.length < 3) {
      setMsg('موضوع حداقل ۳ کاراکتر باشد.');
      return;
    }
    if (b.length < 2) {
      setMsg('متن پیام حداقل ۲ کاراکتر باشد.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.post('/support/tickets', { subject: s, body: b });
      setMsg('تیکت ثبت شد.');
      setShowCreate(false);
      setSubject('');
      setBody('');
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selectedId || reply.trim().length < 1) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.post(`/support/tickets/${selectedId}/messages`, { body: reply.trim() });
      setReply('');
      setMsg('پیام ارسال شد.');
      await openTicket(selectedId);
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  if (selectedId && detail) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedId(null); setDetail(null); }}>
            ← بازگشت به لیست
          </Button>
          <span className="text-sm text-gray">
            {STATUS_LABEL[detail.status] || detail.status}
          </span>
        </div>
        <Card className="space-y-3">
          <h1 className="text-lg font-bold">{detail.subject}</h1>
          <p className="text-xs text-gray">
            {formatDate(detail.createdAt, { style: 'short', includeTime: true })}
          </p>
          <ul className="space-y-3">
            {detail.messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  m.isStaff ? 'bg-coral/10 border border-coral/20' : 'bg-gray-light/60'
                }`}
              >
                <p className="text-xs font-medium text-gray mb-1">
                  {m.isStaff ? 'پشتیبانی' : 'شما'} ·{' '}
                  {formatDate(m.createdAt, { style: 'short', includeTime: true })}
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
          {detail.status !== 'closed' && (
            <div className="space-y-2 border-t border-border pt-3">
              <textarea
                className="min-h-[80px] w-full rounded-xl border border-border px-3 py-2 text-sm"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="پاسخ یا پیام جدید..."
                maxLength={4000}
              />
              <Button size="sm" loading={busy} onClick={sendReply}>
                ارسال
              </Button>
            </div>
          )}
        </Card>
        {msg && <p className="text-sm text-coral">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">پشتیبانی</h1>
        <Button size="sm" onClick={() => { setShowCreate(true); setMsg(null); }}>
          تیکت جدید
        </Button>
      </div>

      {showCreate && (
        <Card className="space-y-3">
          <h2 className="font-semibold">ثبت تیکت جدید</h2>
          <Input
            placeholder="موضوع"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
          />
          <textarea
            className="min-h-[100px] w-full rounded-xl border border-border px-3 py-2 text-sm"
            placeholder="شرح مشکل یا درخواست..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
          />
          <div className="flex gap-2">
            <Button size="sm" loading={busy} onClick={createTicket}>
              ارسال تیکت
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
              انصراف
            </Button>
          </div>
        </Card>
      )}

      {msg && <p className="text-sm text-coral">{msg}</p>}

      {items.length === 0 ? (
        <PanelEmpty title="تیکتی ندارید" description="برای ارتباط با پشتیبانی، تیکت جدید ثبت کنید." />
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="w-full text-right"
                onClick={() => openTicket(t.id)}
              >
                <Card className="hover:border-coral/40 transition-colors space-y-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">{t.subject}</p>
                    <span className="text-xs text-gray">
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </div>
                  {t.lastPreview && (
                    <p className="text-sm text-gray line-clamp-1">{t.lastPreview}</p>
                  )}
                  <p className="text-xs text-gray">
                    {formatDate(t.updatedAt, { style: 'short', includeTime: true })} ·{' '}
                    {t.messageCount} پیام
                  </p>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
