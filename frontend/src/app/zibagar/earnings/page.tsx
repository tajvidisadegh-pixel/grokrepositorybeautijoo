'use client';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice, formatDate } from '@/lib/utils';

type EarningsSummary = {
  professionalNet: number;
  paidCount: number;
  totalEarned?: number;
  totalPaidOut?: number;
  totalPendingPayout?: number;
  available?: number;
  settledCount?: number;
  pendingCount?: number;
};

type PeriodBlock = { earned: number; count: number };

type PaymentRow = {
  id: string;
  amount: number;
  professionalNetAmount?: number | null;
  status: string;
  createdAt: string;
  paidAt?: string | null;
  booking?: {
    id?: string;
    startAt?: string;
    customer?: { phone?: string | null; profile?: { displayName?: string | null } | null } | null;
  } | null;
};

export default function ZibagarEarningsPage() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [periods, setPeriods] = useState<{
    today?: PeriodBlock;
    week?: PeriodBlock;
    month?: PeriodBlock;
    allTime?: PeriodBlock;
  } | null>(null);
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function exportCsv() {
    const rows = [['id', 'amount', 'status', 'createdAt']];
    for (const it of items) {
      rows.push([it.id, String(it.professionalNetAmount ?? it.amount), it.status, it.createdAt]);
    }
    const nl = String.fromCharCode(10);
    const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join(nl);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'beautijoo-earnings.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{
        summary: EarningsSummary;
        periods?: typeof periods;
        items: PaymentRow[];
        notice?: string;
      }>('/professionals/me/earnings?page=1&limit=30');
      setSummary(res.summary);
      setPeriods(res.periods || null);
      setItems(res.items || []);
      setNotice(res.notice || null);
    } catch (e) {
      setSummary(null);
      setItems([]);
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestPayout() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setMsg('مبلغ معتبر وارد کنید');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.post('/professionals/me/payout-requests', { amount: n, note: note.trim() || undefined });
      setMsg('درخواست تسویه ثبت شد');
      setAmount('');
      setNote('');
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={() => void load()} />;

  const bars = [
    { key: 'today', label: 'امروز', earned: periods?.today?.earned ?? 0 },
    { key: 'week', label: 'هفته', earned: periods?.week?.earned ?? 0 },
    { key: 'month', label: 'ماه', earned: periods?.month?.earned ?? 0 },
  ];
  const maxE = Math.max(1, ...bars.map((b) => b.earned));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">درآمد</h1>
        <button type="button" onClick={exportCsv} className="text-xs text-coral underline">
          خروجی CSV
        </button>
      </div>
      {notice && <p className="text-sm text-gray">{notice}</p>}
      {msg && <p className="rounded-xl bg-gray-light px-3 py-2 text-sm">{msg}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        {bars.map((b) => {
          const pct = Math.round((b.earned / maxE) * 100);
          return (
            <Card key={b.key} className="space-y-1 p-4">
              <div className="flex justify-between text-xs text-gray">
                <span>{b.label}</span>
                <span className="font-medium text-foreground">{formatPrice(b.earned)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-gray-light">
                <div className="h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
              </div>
            </Card>
          );
        })}
      </div>

      {summary && (
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-gray">خالص حرفه‌ای</p>
            <p className="text-lg font-bold text-coral">{formatPrice(summary.professionalNet)}</p>
          </div>
          <div>
            <p className="text-xs text-gray">تعداد پرداخت‌شده</p>
            <p className="text-lg font-bold">{summary.paidCount.toLocaleString('fa-IR')}</p>
          </div>
        </Card>
      )}

      <Card className="space-y-3 p-4">
        <h2 className="font-bold">درخواست تسویه</h2>
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="مبلغ" dir="ltr" />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="یادداشت (اختیاری)" />
        <Button loading={busy} onClick={() => void requestPayout()}>
          ثبت درخواست
        </Button>
      </Card>

      {items.length === 0 ? (
        <PanelEmpty title="پرداختی ثبت نشده" description="پس از تکمیل نوبت‌ها، تراکنش‌ها اینجا می‌آیند." />
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id}>
              <Card className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>{formatPrice(it.professionalNetAmount ?? it.amount)}</span>
                <span className="text-gray">{it.status}</span>
                <span className="text-xs text-gray">{formatDate(it.createdAt)}</span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
