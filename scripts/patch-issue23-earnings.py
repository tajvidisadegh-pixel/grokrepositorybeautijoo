#!/usr/bin/env python3
"""Frontend-only earnings page rewrite (issue #23). No backend changes."""
from pathlib import Path

PAGE = Path('frontend/src/app/zibagar/earnings/page.tsx')

NEW = r'''\'use client\';

import { useCallback, useEffect, useMemo, useState } from \'react\';
import { Card } from \'@/components/ui/card\';
import { Button } from \'@/components/ui/button\';
import { Input } from \'@/components/ui/input\';
import { PanelLoading, PanelError, PanelEmpty } from \'@/components/panel/state-blocks\';
import { apiClient } from \'@/lib/api\';
import { friendlyApiError } from \'@/lib/api-errors\';
import { formatPrice, formatDate } from \'@/lib/utils\';

type EarningsSummary = {
  professionalNet?: number;
  paidCount?: number;
  totalEarned?: number;
  totalPaidOut?: number;
  totalPendingPayout?: number;
  available?: number;
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
    customer?: { phone?: string | null; profile?: { displayName?: string | null } | null } | null;
  } | null;
};

type PeriodKey = \'today\' | \'week\' | \'month\' | \'allTime\';
const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: \'امروز\',
  week: \'این هفته\',
  month: \'این ماه\',
  allTime: \'کل دوره\',
};

export default function ZibagarEarningsPage() {
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [periods, setPeriods] = useState<Partial<Record<PeriodKey, PeriodBlock>> | null>(null);
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(\'\');
  const [note, setNote] = useState(\'\');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<PeriodKey>(\'month\');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{
        summary: EarningsSummary;
        periods?: Partial<Record<PeriodKey, PeriodBlock>>;
        items: PaymentRow[];
        notice?: string;
      }>(\'/professionals/me/earnings?page=1&limit=30\');
      setSummary(res.summary);
      if (res.periods) {
        const cleaned: Partial<Record<PeriodKey, PeriodBlock>> = {};
        (Object.keys(PERIOD_LABELS) as PeriodKey[]).forEach((k) => {
          const block = res.periods?.[k];
          if (block) cleaned[k] = { earned: Number(block.earned) || 0, count: Number(block.count) || 0 };
        });
        setPeriods(cleaned);
      } else setPeriods(null);
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

  useEffect(() => { load(); }, [load]);

  async function submitPayout() {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 10000) {
      setMsg(\'حداقل مبلغ ۱۰٬۰۰۰ ریال است.\');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiClient.post<{ message?: string }>(\'/professionals/me/payout-request\', {
        amount: n,
        note: note.trim() || undefined,
      });
      setMsg(res.message || \'درخواست ثبت شد.\');
      setAmount(\'\');
      setNote(\'\');
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  const chartData = useMemo(() => {
    if (!periods) return [];
    return (Object.keys(PERIOD_LABELS) as PeriodKey[]).map((key) => ({
      key,
      label: PERIOD_LABELS[key],
      earned: periods[key]?.earned ?? 0,
      count: periods[key]?.count ?? 0,
    }));
  }, [periods]);

  const maxEarned = useMemo(() => Math.max(1, ...chartData.map((d) => d.earned)), [chartData]);

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={load} />;

  const available = summary?.available ?? summary?.professionalNet ?? 0;
  const earned = summary?.totalEarned ?? summary?.professionalNet ?? 0;
  const paidOut = summary?.totalPaidOut ?? 0;
  const pending = summary?.totalPendingPayout ?? 0;
  const activeBlock = periods?.[activePeriod];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">درآمد و تسویه</h1>
        <p className="mt-1 text-sm text-gray">درآمد از رزروهای پرداخت‌شده — بازه زمانی و قابل برداشت</p>
      </div>
      {notice && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>}
      {msg && <p className="rounded-xl bg-blue-light px-3 py-2 text-sm text-blue">{msg}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-gray">کل درآمد</p>
          <p className="mt-1 text-lg font-bold">{formatPrice(earned)}</p>
          <p className="text-xs text-gray">{summary?.paidCount ?? 0} نوبت پرداخت‌شده</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray">تسویه‌شده</p>
          <p className="mt-1 text-lg font-bold text-emerald-700">{formatPrice(paidOut)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray">در صف تسویه</p>
          <p className="mt-1 text-lg font-bold text-amber-700">{formatPrice(pending)}</p>
        </Card>
        <Card className="border-coral/30 p-4">
          <p className="text-xs text-gray">قابل برداشت</p>
          <p className="mt-1 text-lg font-bold text-coral">{formatPrice(available)}</p>
        </Card>
      </div>
      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">درآمد بر اساس بازه</h2>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((key) => (
              <button key={key} type="button" onClick={() => setActivePeriod(key)}
                className={`rounded-full px-3 py-1 text-xs ${
                  activePeriod === key ? \'bg-coral text-white\' : \'border border-border bg-white text-foreground\'
                }`}>{PERIOD_LABELS[key]}</button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border/80 bg-gray-light/30 p-4">
          <p className="text-sm text-gray">{PERIOD_LABELS[activePeriod]}</p>
          <p className="mt-1 text-2xl font-bold text-coral">{formatPrice(activeBlock?.earned ?? 0)}</p>
          <p className="text-xs text-gray">{activeBlock?.count ?? 0} نوبت</p>
        </div>
        {chartData.length > 0 && (
          <div className="space-y-3" dir="ltr">
            {chartData.map((d) => {
              const pct = Math.round((d.earned / maxEarned) * 100);
              return (
                <div key={d.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray" dir="rtl">
                    <span>{d.label}</span>
                    <span className="font-medium text-foreground">{formatPrice(d.earned)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-gray-light">
                    <div className={`h-full rounded-full transition-all ${
                      d.key === activePeriod ? \'bg-coral\' : \'bg-coral/50\'
                    }`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">درخواست تسویه</h2>
        <p className="text-xs text-gray">فقط از مبلغ «قابل برداشت» درخواست دهید.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray">مبلغ (ریال)</label>
            <Input type="number" min={10000} value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">یادداشت (اختیاری)</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="شماره کارت / توضیح" />
          </div>
        </div>
        <Button size="sm" loading={busy} onClick={submitPayout} disabled={available < 10000}>ثبت درخواست تسویه</Button>
      </Card>
      <div>
        <h2 className="mb-3 font-semibold">تراکنش‌های درآمد</h2>
        {items.length === 0 ? (
          <PanelEmpty title="تراکنشی نیست" description="پس از پرداخت موفق رزروها اینجا نمایش داده می‌شوند." />
        ) : (
          <ul className="space-y-2">
            {items.map((p) => {
              const customer = p.booking?.customer?.profile?.displayName || p.booking?.customer?.phone || \'مشتری\';
              const income = p.professionalNetAmount != null && p.professionalNetAmount >= 0 ? p.professionalNetAmount : p.amount;
              return (
                <li key={p.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <div>
                      <p className="font-medium">{customer}</p>
                      <p className="text-xs text-gray">{formatDate(p.paidAt || p.createdAt, { style: \'short\', includeTime: true })}</p>
                    </div>
                    <div className="text-left" dir="ltr">
                      <p className="font-semibold text-coral">{formatPrice(income)}</p>
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
'''

def main():
    # Fix escaped quotes from r''' with \'  -> use decode
    text = NEW.encode('utf-8').decode('unicode_escape') if False else NEW
    # NEW was written with \' which is wrong for final file - rebuild without escapes
    raise SystemExit('use binary approach')

if __name__ == '__main__':
    main()
