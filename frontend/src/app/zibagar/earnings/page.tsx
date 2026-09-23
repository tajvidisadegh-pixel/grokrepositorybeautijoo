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
    load();
  }, [load]);

  async function submitPayout() {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 10000) {
      setMsg('حداقل مبلغ ۱۰٬۰۰۰ ریال است.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiClient.post<{ message?: string }>('/professionals/me/payout-request', {
        amount: n,
        note: note.trim() || undefined,
      });
      setMsg(res.message || 'درخواست ثبت شد.');
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
  if (error) return <PanelError message={error} onRetry={load} />;

  const available = summary?.available ?? summary?.professionalNet ?? 0;
  const earned = summary?.totalEarned ?? summary?.professionalNet ?? 0;
  const paidOut = summary?.totalPaidOut ?? 0;
  const pending = summary?.totalPendingPayout ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">درآمد و تسویه</h1>
        <p className="mt-1 text-sm text-gray">
          محاسبه خودکار از رزروهای پرداخت‌شده — تفکیک پرداخت‌شده و پرداخت‌نشده
        </p>
      </div>

      {notice && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>
      )}
      {msg && <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">{msg}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-gray">کل درآمد</p>
          <p className="mt-1 text-lg font-bold">{formatPrice(earned)}</p>
          <p className="text-xs text-gray">{summary?.paidCount ?? 0} تراکنش پرداخت‌شده مشتری</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray">تسویه‌شده (پرداخت به شما)</p>
          <p className="mt-1 text-lg font-bold text-emerald-700">{formatPrice(paidOut)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray">در صف تسویه</p>
          <p className="mt-1 text-lg font-bold text-amber-700">{formatPrice(pending)}</p>
        </Card>
        <Card className="p-4 border-coral/30">
          <p className="text-xs text-gray">قابل برداشت</p>
          <p className="mt-1 text-lg font-bold text-coral">{formatPrice(available)}</p>
        </Card>
      </div>

      {periods && (() => {
        const bars = [
          { key: 'today', label: 'امروز', earned: periods.today?.earned ?? 0, count: periods.today?.count ?? 0 },
          { key: 'week', label: 'این هفته', earned: periods.week?.earned ?? 0, count: periods.week?.count ?? 0 },
          { key: 'month', label: 'این ماه', earned: periods.month?.earned ?? 0, count: periods.month?.count ?? 0 },
          { key: 'allTime', label: 'کل دوره', earned: periods.allTime?.earned ?? 0, count: periods.allTime?.count ?? 0 },
        ];
        const maxEarned = Math.max(1, ...bars.map((b) => b.earned));
        return (
          <Card className="space-y-4 p-4">
            <h2 className="font-semibold">درآمد بر اساس بازه زمانی</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {bars.map((b) => (
                <div key={b.key} className="rounded-xl border border-border/80 bg-gray-light/20 p-3">
                  <p className="text-xs text-gray">{b.label}</p>
                  <p className="mt-1 font-bold">{formatPrice(b.earned)}</p>
                  <p className="text-xs text-gray">{b.count} نوبت</p>
                </div>
              ))}
            </div>
            <div className="space-y-2" dir="ltr">
              {bars.map((b) => {
                const pct = Math.round((b.earned / maxEarned) * 100);
                return (
                  <div key={`bar-${b.key}`} className="space-y-1">
                    <div className="flex justify-between text-xs text-gray" dir="rtl">
                      <span>{b.label}</span>
                      <span className="font-medium text-foreground">{formatPrice(b.earned)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-gray-light">
                      <div className="h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">درخواست تسویه</h2>
        <p className="text-xs text-gray">
          فقط از مبلغ «قابل برداشت» می‌توانید درخواست دهید. پس از پرداخت مدیریت، وضعیت به تسویه‌شده می‌رود.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray">مبلغ (ریال)</label>
            <Input
              type="number"
              min={10000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              dir="ltr"
              placeholder="مثلاً ۵۰۰۰۰۰"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">یادداشت (اختیاری)</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="شماره کارت / توضیح" />
          </div>
        </div>
        <Button size="sm" loading={busy} onClick={submitPayout} disabled={available < 10000}>
          ثبت درخواست تسویه
        </Button>
      </Card>

      <div>
        <h2 className="mb-3 font-semibold">تراکنش‌های درآمد</h2>
        {items.length === 0 ? (
          <PanelEmpty title="تراکنشی نیست" description="پس از پرداخت موفق رزروها، اینجا نمایش داده می‌شوند." />
        ) : (
          <ul className="space-y-2">
            {items.map((p) => {
              const customer =
                p.booking?.customer?.profile?.displayName ||
                p.booking?.customer?.phone ||
                'مشتری';
              const net = p.professionalNetAmount != null && p.professionalNetAmount >= 0 ? p.professionalNetAmount : p.amount;
              return (
                <li key={p.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <div>
                      <p className="font-medium">{customer}</p>
                      <p className="text-xs text-gray">
                        {formatDate(p.paidAt || p.createdAt, { style: 'short', includeTime: true })}
                      </p>
                    </div>
                    <div className="text-left" dir="ltr">
                      <p className="font-semibold text-coral">{formatPrice(net)}</p>
                      <p className="text-xs text-gray">درآمد</p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
