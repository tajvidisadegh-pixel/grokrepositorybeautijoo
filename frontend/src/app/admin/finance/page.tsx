'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchAdminFinancialSummary,
  fetchAdminFinancialTransactions,
  fetchAdminFinancialTransactionDetail,
  fetchAdminCommissionSetting,
  updateAdminCommissionSetting,
  fetchAdminFailedTransactionsAlert,
  updateAdminFailedTransactionsThreshold,
  type AdminFinancialSummary,
  type AdminFinancialTransaction,
  type AdminFinancialTransactionDetail,
  type AdminCommissionSetting,
  type AdminFinancialPeriod,
  type HourlyFailedAlert,
} from '@/lib/admin-finance-api';
import { persianPaymentStatus } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';
import { formatPrice } from '@/lib/utils';

export default function AdminFinancePage() {
  const [period, setPeriod] = useState<AdminFinancialPeriod>('all_time');
  const [summary, setSummary] = useState<AdminFinancialSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<AdminFinancialTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [detail, setDetail] = useState<AdminFinancialTransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [commission, setCommission] = useState<AdminCommissionSetting | null>(null);
  const [commissionInput, setCommissionInput] = useState('');
  const [commissionBusy, setCommissionBusy] = useState(false);
  const [commissionMsg, setCommissionMsg] = useState<string | null>(null);

  const [failedAlert, setFailedAlert] = useState<HourlyFailedAlert | null>(null);
  const [thresholdInput, setThresholdInput] = useState('');
  const [thresholdBusy, setThresholdBusy] = useState(false);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetchAdminFinancialSummary(period);
      setSummary(res);
    } catch (e) {
      setSummaryError(friendlyApiError(e));
    } finally {
      setSummaryLoading(false);
    }
  }, [period]);

  const loadTransactions = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetchAdminFinancialTransactions({
        page,
        limit: 20,
        status: statusFilter || undefined,
        provider: providerFilter || undefined,
        search: search.trim() || undefined,
      });
      setTransactions(res.items || []);
      setTotalPages(res.meta?.totalPages || 1);
      setTotalCount(res.meta?.total || 0);
    } catch (e) {
      setListError(friendlyApiError(e));
    } finally {
      setListLoading(false);
    }
  }, [page, statusFilter, providerFilter, search]);

  const loadSettings = useCallback(async () => {
    try {
      const [c, a] = await Promise.all([
        fetchAdminCommissionSetting(),
        fetchAdminFailedTransactionsAlert(),
      ]);
      setCommission(c);
      setCommissionInput(String(c.rate));
      setFailedAlert(a);
      setThresholdInput(String(a.threshold));
    } catch (e) {
      setCommissionMsg(e instanceof Error ? e.message : 'بارگذاری تنظیمات ناموفق بود');
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleOpenDetail(id: string) {
    setDetailLoading(true);
    try {
      setDetail(await fetchAdminFinancialTransactionDetail(id));
    } catch (e) {
      setListError(friendlyApiError(e));
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSaveCommission() {
    const rate = Number(commissionInput);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      setCommissionMsg('نرخ باید بین ۰ تا ۱۰۰ باشد');
      return;
    }
    setCommissionBusy(true);
    setCommissionMsg(null);
    try {
      const res = await updateAdminCommissionSetting(rate);
      setCommissionMsg(res.notice || 'ذخیره شد');
      await loadSettings();
    } catch (e) {
      setCommissionMsg(friendlyApiError(e));
    } finally {
      setCommissionBusy(false);
    }
  }

  async function handleSaveThreshold() {
    const threshold = Number(thresholdInput);
    if (Number.isNaN(threshold) || threshold < 1) {
      return;
    }
    setThresholdBusy(true);
    try {
      await updateAdminFailedTransactionsThreshold(threshold);
      await loadSettings();
    } catch (e) {
      setListError(friendlyApiError(e));
    } finally {
      setThresholdBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مدیریت مالی</h1>
        <p className="mt-1 text-sm text-gray">خلاصه درآمد، تراکنش‌ها و تنظیمات کارمزد</p>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(['today', 'this_month', 'all_time'] as AdminFinancialPeriod[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? 'primary' : 'outline'}
              onClick={() => setPeriod(p)}
            >
              {p === 'today' ? 'امروز' : p === 'this_month' ? 'این ماه' : 'کل'}
            </Button>
          ))}
        </div>
        {summaryLoading ? (
          <PanelLoading label="بارگذاری خلاصه..." />
        ) : summaryError ? (
          <PanelError message={summaryError} onRetry={loadSummary} />
        ) : summary ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-gray-light/60 p-3">
              <p className="text-xs text-gray">درآمد ناخالص</p>
              <p className="text-lg font-bold">{formatPrice(summary.grossRevenue)}</p>
            </div>
            <div className="rounded-xl bg-gray-light/60 p-3">
              <p className="text-xs text-gray">کارمزد پلتفرم</p>
              <p className="text-lg font-bold text-coral">{formatPrice(summary.platformCommission ?? 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-light/60 p-3">
              <p className="text-xs text-gray">سهم زیباگر</p>
              <p className="text-lg font-bold">{formatPrice(summary.professionalNet ?? 0)}</p>
            </div>
            <div className="rounded-xl bg-gray-light/60 p-3">
              <p className="text-xs text-gray">تراکنش موفق / ناموفق</p>
              <p className="text-lg font-bold">
                {summary.transactions?.paid ?? 0} / {summary.transactions?.failed ?? 0}
              </p>
            </div>
          </div>
        ) : (
          <PanelEmpty title="خلاصه‌ای موجود نیست" />
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">تنظیم کارمزد و هشدار</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm">نرخ کارمزد (%)</label>
            <div className="flex gap-2">
              <Input value={commissionInput} onChange={(e) => setCommissionInput(e.target.value)} dir="ltr" />
              <Button size="sm" loading={commissionBusy} onClick={handleSaveCommission}>
                ذخیره
              </Button>
            </div>
            {commissionMsg && <p className="text-xs text-blue">{commissionMsg}</p>}
            {commission?.notice && <p className="text-xs text-gray">{commission.notice}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm">آستانه هشدار تراکنش ناموفق</label>
            <div className="flex gap-2">
              <Input value={thresholdInput} onChange={(e) => setThresholdInput(e.target.value)} dir="ltr" />
              <Button size="sm" loading={thresholdBusy} onClick={handleSaveThreshold}>
                ذخیره
              </Button>
            </div>
            {failedAlert && (
              <p className="text-xs text-gray">
                یک ساعت اخیر: {failedAlert.failedCount} ناموفق — آستانه {failedAlert.threshold}
                {failedAlert.isTriggered ? ' (هشدار فعال)' : ''}
              </p>
            )}
          </div>
        </div>
      </Card>

      {failedAlert?.recentFailed?.length ? (
        <Card className="space-y-2">
          <h2 className="font-bold text-rose-700">تراکنش‌های ناموفق اخیر</h2>
          <ul className="space-y-2">
            {failedAlert.recentFailed.map((item) => (
              <li key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs">
                  <div className="flex flex-wrap gap-3">
                    <span className="font-mono text-gray-500">{item.id.slice(0, 8)}...</span>
                    <span className="font-semibold text-rose-700">{formatPrice(item.amount)}</span>
                    <span className="text-gray-600">مشتری: {item.customerName}</span>
                    {item.professionalTitle && (
                      <span className="text-gray-500 hidden sm:inline">زیباگر: {item.professionalTitle}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-[11px]" dir="ltr">
                      {item.failedAt ? new Date(item.failedAt).toLocaleTimeString('fa-IR') : '—'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => handleOpenDetail(item.id)}
                    >
                      جزئیات
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-gray">وضعیت</label>
            <select
              className="h-9 rounded-xl border border-border bg-white px-2 text-sm"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">همه</option>
              <option value="paid">پرداخت‌شده</option>
              <option value="pending">در انتظار</option>
              <option value="failed">ناموفق</option>
              <option value="cancelled">لغو</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">درگاه</label>
            <Input
              className="h-9"
              value={providerFilter}
              onChange={(e) => {
                setPage(1);
                setProviderFilter(e.target.value);
              }}
              placeholder="zibal / zarinpal"
              dir="ltr"
            />
          </div>
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-xs text-gray">جستجو</label>
            <Input
              className="h-9"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="نام، موبایل، ref..."
            />
          </div>
          <Button size="sm" variant="outline" onClick={loadTransactions}>
            بروزرسانی
          </Button>
        </div>

        {listLoading ? (
          <PanelLoading />
        ) : listError ? (
          <PanelError message={listError} onRetry={loadTransactions} />
        ) : transactions.length === 0 ? (
          <PanelEmpty title="تراکنشی یافت نشد" />
        ) : (
          <ul className="space-y-2">
            {transactions.map((tx) => (
              <li key={tx.id}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-right text-sm hover:bg-gray-light/50"
                  onClick={() => handleOpenDetail(tx.id)}
                >
                  <div>
                    <p className="font-medium">{formatPrice(tx.amount)}</p>
                    <p className="text-xs text-gray">
                      {tx.booking?.customer?.profile?.displayName || tx.booking?.customer?.phone || '—'}
                      {' · '}
                      {tx.provider}
                    </p>
                  </div>
                  <span className="rounded-full bg-coral-soft px-2 py-0.5 text-xs text-coral">
                    {persianPaymentStatus(tx.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between text-xs text-gray">
          <span>
            صفحه {page} از {totalPages} — {totalCount} مورد
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              قبلی
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </Button>
          </div>
        </div>
      </Card>

      {(detail || detailLoading) && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">جزئیات تراکنش</h2>
            <Button size="sm" variant="ghost" onClick={() => setDetail(null)}>
              بستن
            </Button>
          </div>
          {detailLoading ? (
            <PanelLoading />
          ) : detail ? (
            <div className="space-y-1 text-sm">
              <p>مبلغ: {formatPrice(detail.amount)}</p>
              <p>وضعیت: {persianPaymentStatus(detail.status)}</p>
              <p>درگاه: {detail.provider}</p>
              <p dir="ltr">ref: {detail.providerRef || '—'}</p>
              {detail.providerNote && <p className="text-gray">{detail.providerNote}</p>}
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
