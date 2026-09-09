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
} from '@/lib/panel-api';
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
      setCommissionMsg(e instanceof Error ? e.message : '\u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc \u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062f');
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
      setCommissionMsg('\u0646\u0631\u062e \u0628\u0627\u06cc\u062f \u0628\u06cc\u0646 \u06f0 \u062a\u0627 \u06f1\u06f0\u06f0 \u0628\u0627\u0634\u062f');
      return;
    }
    setCommissionBusy(true);
    setCommissionMsg(null);
    try {
      const res = await updateAdminCommissionSetting(rate);
      setCommissionMsg(res.notice || '\u0630\u062e\u06cc\u0631\u0647 \u0634\u062f');
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
        <h1 className="text-2xl font-bold">\u0645\u062f\u06cc\u0631\u06cc\u062a \u0645\u0627\u0644\u06cc</h1>
        <p className="mt-1 text-sm text-gray">\u062e\u0644\u0627\u0635\u0647 \u062f\u0631\u0622\u0645\u062f\u060c \u062a\u0631\u0627\u06a9\u0646\u0634\u200c\u0647\u0627 \u0648 \u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u06a9\u0627\u0631\u0645\u0632\u062f</p>
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
              {p === 'today' ? '\u0627\u0645\u0631\u0648\u0632' : p === 'this_month' ? '\u0627\u06cc\u0646 \u0645\u0627\u0647' : '\u06a9\u0644'}
            </Button>
          ))}
        </div>
        {summaryLoading ? (
          <PanelLoading label="\u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc \u062e\u0644\u0627\u0635\u0647..." />
        ) : summaryError ? (
          <PanelError message={summaryError} onRetry={loadSummary} />
        ) : summary ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-gray-light/60 p-3">
              <p className="text-xs text-gray">\u062f\u0631\u0622\u0645\u062f \u0646\u0627\u062e\u0627\u0644\u0635</p>
              <p className="text-lg font-bold">{formatPrice(summary.grossRevenue)}</p>
            </div>
            <div className="rounded-xl bg-gray-light/60 p-3">
              <p className="text-xs text-gray">\u06a9\u0627\u0631\u0645\u0632\u062f \u067e\u0644\u062a\u0641\u0631\u0645</p>
              <p className="text-lg font-bold text-coral">{formatPrice(summary.platformCommission)}</p>
            </div>
            <div className="rounded-xl bg-gray-light/60 p-3">
              <p className="text-xs text-gray">\u0633\u0647\u0645 \u0632\u06cc\u0628\u0627\u06af\u0631</p>
              <p className="text-lg font-bold">{formatPrice(summary.professionalNet)}</p>
            </div>
            <div className="rounded-xl bg-gray-light/60 p-3">
              <p className="text-xs text-gray">\u062a\u0631\u0627\u06a9\u0646\u0634 \u0645\u0648\u0641\u0642 / \u0646\u0627\u0645\u0648\u0641\u0642</p>
              <p className="text-lg font-bold">
                {summary.transactions.paid} / {summary.transactions.failed}
              </p>
            </div>
          </div>
        ) : (
          <PanelEmpty title="\u062e\u0644\u0627\u0635\u0647\u200c\u0627\u06cc \u0645\u0648\u062c\u0648\u062f \u0646\u06cc\u0633\u062a" />
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">\u062a\u0646\u0638\u06cc\u0645 \u06a9\u0627\u0631\u0645\u0632\u062f \u0648 \u0647\u0634\u062f\u0627\u0631</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm">\u0646\u0631\u062e \u06a9\u0627\u0631\u0645\u0632\u062f (%)</label>
            <div className="flex gap-2">
              <Input value={commissionInput} onChange={(e) => setCommissionInput(e.target.value)} dir="ltr" />
              <Button size="sm" loading={commissionBusy} onClick={handleSaveCommission}>
                \u0630\u062e\u06cc\u0631\u0647
              </Button>
            </div>
            {commissionMsg && <p className="text-xs text-blue">{commissionMsg}</p>}
            {commission?.notice && <p className="text-xs text-gray">{commission.notice}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm">\u0622\u0633\u062a\u0627\u0646\u0647 \u0647\u0634\u062f\u0627\u0631 \u062a\u0631\u0627\u06a9\u0646\u0634 \u0646\u0627\u0645\u0648\u0641\u0642</label>
            <div className="flex gap-2">
              <Input value={thresholdInput} onChange={(e) => setThresholdInput(e.target.value)} dir="ltr" />
              <Button size="sm" loading={thresholdBusy} onClick={handleSaveThreshold}>
                \u0630\u062e\u06cc\u0631\u0647
              </Button>
            </div>
            {failedAlert && (
              <p className="text-xs text-gray">
                \u06cc\u06a9 \u0633\u0627\u0639\u062a \u0627\u062e\u06cc\u0631: {failedAlert.failedCount} \u0646\u0627\u0645\u0648\u0641\u0642 \u2014 \u0622\u0633\u062a\u0627\u0646\u0647 {failedAlert.threshold}
                {failedAlert.isTriggered ? ' (\u0647\u0634\u062f\u0627\u0631 \u0641\u0639\u0627\u0644)' : ''}
              </p>
            )}
          </div>
        </div>
      </Card>

      {failedAlert?.recentFailed?.length ? (
        <Card className="space-y-2">
          <h2 className="font-bold text-rose-700">\u062a\u0631\u0627\u06a9\u0646\u0634\u200c\u0647\u0627\u06cc \u0646\u0627\u0645\u0648\u0641\u0642 \u0627\u062e\u06cc\u0631</h2>
          <ul className="space-y-2">
            {failedAlert.recentFailed.map((item) => (
              <li key={item.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs">
                  <div className="flex flex-wrap gap-3">
                    <span className="font-mono text-gray-500">{item.id.slice(0, 8)}...</span>
                    <span className="font-semibold text-rose-700">{formatPrice(item.amount)}</span>
                    <span className="text-gray-600">\u0645\u0634\u062a\u0631\u06cc: {item.customerName}</span>
                    {item.professionalTitle && (
                      <span className="text-gray-500 hidden sm:inline">\u0632\u06cc\u0628\u0627\u06af\u0631: {item.professionalTitle}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-[11px]" dir="ltr">
                      {item.failedAt ? new Date(item.failedAt).toLocaleTimeString('fa-IR') : '\u2014'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => handleOpenDetail(item.id)}
                    >
                      \u062c\u0632\u0626\u06cc\u0627\u062a
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
            <label className="mb-1 block text-xs text-gray">\u0648\u0636\u0639\u06cc\u062a</label>
            <select
              className="h-9 rounded-xl border border-border bg-white px-2 text-sm"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">\u0647\u0645\u0647</option>
              <option value="paid">\u067e\u0631\u062f\u0627\u062e\u062a\u200c\u0634\u062f\u0647</option>
              <option value="pending">\u062f\u0631 \u0627\u0646\u062a\u0638\u0627\u0631</option>
              <option value="failed">\u0646\u0627\u0645\u0648\u0641\u0642</option>
              <option value="cancelled">\u0644\u063a\u0648</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">\u062f\u0631\u06af\u0627\u0647</label>
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
            <label className="mb-1 block text-xs text-gray">\u062c\u0633\u062a\u062c\u0648</label>
            <Input
              className="h-9"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="\u0646\u0627\u0645\u060c \u0645\u0648\u0628\u0627\u06cc\u0644\u060c ref..."
            />
          </div>
          <Button size="sm" variant="outline" onClick={loadTransactions}>
            \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06cc
          </Button>
        </div>

        {listLoading ? (
          <PanelLoading />
        ) : listError ? (
          <PanelError message={listError} onRetry={loadTransactions} />
        ) : transactions.length === 0 ? (
          <PanelEmpty title="\u062a\u0631\u0627\u06a9\u0646\u0634\u06cc \u06cc\u0627\u0641\u062a \u0646\u0634\u062f" />
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
                      {tx.booking?.customer?.profile?.displayName || tx.booking?.customer?.phone || '\u2014'}
                      {' \u00b7 '}
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
            \u0635\u0641\u062d\u0647 {page} \u0627\u0632 {totalPages} \u2014 {totalCount} \u0645\u0648\u0631\u062f
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              \u0642\u0628\u0644\u06cc
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              \u0628\u0639\u062f\u06cc
            </Button>
          </div>
        </div>
      </Card>

      {(detail || detailLoading) && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">\u062c\u0632\u0626\u06cc\u0627\u062a \u062a\u0631\u0627\u06a9\u0646\u0634</h2>
            <Button size="sm" variant="ghost" onClick={() => setDetail(null)}>
              \u0628\u0633\u062a\u0646
            </Button>
          </div>
          {detailLoading ? (
            <PanelLoading />
          ) : detail ? (
            <div className="space-y-1 text-sm">
              <p>\u0645\u0628\u0644\u063a: {formatPrice(detail.amount)}</p>
              <p>\u0648\u0636\u0639\u06cc\u062a: {persianPaymentStatus(detail.status)}</p>
              <p>\u062f\u0631\u06af\u0627\u0647: {detail.provider}</p>
              <p dir="ltr">ref: {detail.providerRef || '\u2014'}</p>
              {detail.providerNote && <p className="text-gray">{detail.providerNote}</p>}
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
