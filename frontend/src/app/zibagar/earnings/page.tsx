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
  grossRevenue: number;
  platformCommission: number;
  professionalNet: number;
  paidCount: number;
};

type PaymentRow = {
  id: string;
  amount: number;
  professionalNetAmount?: number | null;
  platformCommissionAmount?: number | null;
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
        items: PaymentRow[];
        notice?: string;
      }>('/professionals/me/earnings?page=1&limit=30');
      setSummary(res.summary);
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
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">درآمد و تسویه</h1>
        <p className="mt-1 text-sm text-gray">خلاصه درآمد خالص از رزروهای پرداخت‌شده</p>
      </div>

      {notice && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>
      )}
      {msg && <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">{msg}</p>}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-gray">فروش ناخالص</p>
            <p className="mt-1 text-lg font-bold">{formatPrice(summary.grossRevenue)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray">کارمزد پلتفرم</p>
            <p className="mt-1 text-lg font-bold">{formatPrice(summary.platformCommission)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray">درآمد خالص شما</p>
            <p className="mt-1 text-lg font-bold text-coral">{formatPrice(summary.professionalNet)}</p>
            <p className="mt-0.5 text-xs text-gray">{summary.paidCount} تراکنش</p>
          </Card>
        </div>
      )}

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">درخواست تسویه</h2>
        <p className="text-xs text-gray">
          مبلغ درخواستی توسط ادمین به‌صورت دستی بررسی و پرداخت می‌شود (فاز اول).
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
        <Button size="sm" loading={busy} onClick={submitPayout}>
          ثبت درخواست تسویه
        </Button>
      </Card>

      <div>
        <h2 className="mb-3 font-semibold">تراکنش‌های اخیر</h2>
        {items.length === 0 ? (
          <PanelEmpty title="تراکنشی نیست" description="پس از پرداخت موفق رزروها، اینجا نمایش داده می‌شوند." />
        ) : (
          <ul className="space-y-2">
            {items.map((p) => {
              const customer =
                p.booking?.customer?.profile?.displayName ||
                p.booking?.customer?.phone ||
                'مشتری';
              const net = p.professionalNetAmount ?? Math.max(0, p.amount - (p.platformCommissionAmount || 0));
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
                      <p className="text-xs text-gray">ناخالص {formatPrice(p.amount)}</p>
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
