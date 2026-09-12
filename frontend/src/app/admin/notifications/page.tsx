'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchAdminNotificationCampaigns,
  fetchAdminCampaignRecipients,
  adminRetryFailedCampaign,
  adminNotifyByFilter,
  type AdminNotificationCampaign,
  type AdminCampaignRecipient,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatDateTime } from '@/lib/utils';

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<AdminNotificationCampaign[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<AdminNotificationCampaign | null>(null);
  const [recipients, setRecipients] = useState<AdminCampaignRecipient[]>([]);
  const [recMeta, setRecMeta] = useState({ page: 1, total: 0, totalPages: 0 });
  const [recStatus, setRecStatus] = useState('');
  const [recLoading, setRecLoading] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [notifySms, setNotifySms] = useState(false);
  const [notifyTarget, setNotifyTarget] = useState<'customers' | 'never_notified' | 'has_paid'>('customers');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminNotificationCampaigns(page, 20, search.trim() || undefined);
      setItems(res.items);
      setMeta(res.meta);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openCampaign = async (c: AdminNotificationCampaign, status = '') => {
    setActiveCampaign(c);
    setRecStatus(status);
    setRecLoading(true);
    try {
      const res = await fetchAdminCampaignRecipients(c.campaignId, {
        status: status || undefined,
        page: 1,
        limit: 50,
      });
      setRecipients(res.items || []);
      setRecMeta({
        page: res.meta?.page ?? 1,
        total: res.meta?.total ?? (res.items || []).length,
        totalPages: res.meta?.totalPages ?? 1,
      });
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setRecLoading(false);
    }
  };

  const retryFailed = async (campaignId: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminRetryFailedCampaign(campaignId);
      setMsg(`ارسال مجدد: ${res.retried} از ${res.totalFailed ?? res.retried}`);
      await load();
      if (activeCampaign?.campaignId === campaignId) {
        await openCampaign(activeCampaign, recStatus);
      }
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const sendNewNotification = async () => {
    if (!notifyTitle.trim() || !notifyBody.trim()) {
      setMsg('عنوان و متن اعلان الزامی است');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const filters: Record<string, unknown> = { accountType: 'customer' };
      if (notifyTarget === 'never_notified') filters.neverNotified = true;
      if (notifyTarget === 'has_paid') filters.hasPaid = true;
      const res = await adminNotifyByFilter({
        title: notifyTitle.trim(),
        body: notifyBody.trim(),
        sms: notifySms,
        limit: 500,
        filters,
      });
      setMsg(
        `اعلان برای ${res.notified} نفر ارسال شد` +
          (notifySms ? ` (پیامک: ${res.smsSent ?? 0})` : '') +
          (res.campaignId ? ` · کمپین: ${res.campaignId}` : ''),
      );
      setComposeOpen(false);
      await load();
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading && items.length === 0) return <PanelLoading />;
  if (error && items.length === 0) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">اعلان‌ها و کمپین‌ها</h1>
          <p className="mt-1 text-sm text-gray">ارسال اعلان جدید، تاریخچه کمپین‌ها و وضعیت گیرندگان</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700"
          onClick={() => {
            setNotifyTitle('');
            setNotifyBody('');
            setNotifySms(false);
            setNotifyTarget('customers');
            setComposeOpen(true);
          }}
        >
          ارسال اعلان جدید
        </button>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm">
          {msg}
          <button type="button" className="mr-3 text-xs underline" onClick={() => setMsg(null)}>
            بستن
          </button>
        </div>
      )}

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs text-gray">جستجو در عنوان/متن</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
            placeholder="عنوان کمپین..."
          />
        </div>
        <button
          type="button"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white"
          onClick={() => {
            setPage(1);
            load();
          }}
        >
          جستجو
        </button>
      </Card>

      {items.length === 0 ? (
        <PanelEmpty title="کمپینی ثبت نشده — از دکمه «ارسال اعلان جدید» استفاده کنید" />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-gray-light/60 text-right">
              <tr>
                <th className="p-3 font-semibold">عنوان</th>
                <th className="p-3 font-semibold">زمان</th>
                <th className="p-3 font-semibold">کل</th>
                <th className="p-3 font-semibold">ارسال‌شده</th>
                <th className="p-3 font-semibold">ناموفق</th>
                <th className="p-3 font-semibold">خوانده‌شده</th>
                <th className="p-3 font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.campaignId} className="border-t hover:bg-gray-light/30">
                  <td className="p-3">
                    <div className="font-medium">{c.title}</div>
                    <div className="mt-0.5 max-w-xs truncate text-xs text-gray">{c.body}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">{formatDateTime(c.createdAt)}</td>
                  <td className="p-3">{c.total}</td>
                  <td className="p-3 text-green-700">{c.sent}</td>
                  <td className="p-3 text-red-700">{c.failed}</td>
                  <td className="p-3">{c.read}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => openCampaign(c)}>
                        گیرندگان
                      </button>
                      {c.failed > 0 && (
                        <button
                          type="button"
                          className="rounded border border-orange-300 px-2 py-1 text-xs text-orange-800"
                          disabled={busy}
                          onClick={() => retryFailed(c.campaignId)}
                        >
                          Retry ناموفق
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button type="button" className="rounded border px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            قبلی
          </button>
          <span>
            صفحه {page} از {meta.totalPages}
          </span>
          <button type="button" className="rounded border px-3 py-1 disabled:opacity-40" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
            بعدی
          </button>
        </div>
      )}

      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setComposeOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="mb-4 text-lg font-bold">ارسال اعلان جدید</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray">گیرندگان</label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={notifyTarget}
                  onChange={(e) => setNotifyTarget(e.target.value as typeof notifyTarget)}
                >
                  <option value="customers">همه مشتریان</option>
                  <option value="never_notified">مشتریانی که هرگز اعلان نگرفته‌اند</option>
                  <option value="has_paid">مشتریان دارای پرداخت</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray">عنوان</label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={notifyTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                  placeholder="عنوان اعلان"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray">متن</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  rows={4}
                  value={notifyBody}
                  onChange={(e) => setNotifyBody(e.target.value)}
                  placeholder="متن اعلان..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={notifySms} onChange={(e) => setNotifySms(e.target.checked)} />
                ارسال پیامک هم
              </label>
              <div className="flex flex-col gap-2 pt-3">
                <button
                  type="button"
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                  disabled={busy}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void sendNewNotification();
                  }}
                >
                  {busy ? 'در حال ارسال...' : 'تأیید و ارسال اعلان'}
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setComposeOpen(false)}
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeCampaign && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setActiveCampaign(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">{activeCampaign.title}</h2>
                <p className="text-xs text-gray">{activeCampaign.campaignId}</p>
              </div>
              <button type="button" className="text-sm underline" onClick={() => setActiveCampaign(null)}>
                بستن
              </button>
            </div>
            {recLoading ? (
              <PanelLoading />
            ) : recipients.length === 0 ? (
              <p className="text-sm text-gray">گیرنده‌ای یافت نشد</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recipients.map((r) => (
                  <li key={r.id} className="rounded border p-2">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{r.displayName || r.phone || r.userId.slice(0, 8)}</span>
                      <span className={`text-xs ${r.status === 'failed' ? 'text-red-700' : 'text-green-700'}`}>
                        {r.status === 'failed' ? 'ناموفق' : 'ارسال‌شده'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-gray">جمع: {recMeta.total}</p>
          </div>
        </div>
      )}
    </div>
  );
}
