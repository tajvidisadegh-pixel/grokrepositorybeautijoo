'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

type TargetKey = 'all' | 'customers' | 'professionals' | 'never_notified' | 'has_paid';

const TARGETS: { key: TargetKey; label: string; help: string }[] = [
  {
    key: 'customers',
    label: 'همه مشتریان',
    help: 'اعلان برای کاربران با نقش مشتری ارسال می‌شود.',
  },
  {
    key: 'professionals',
    label: 'همه زیباگرها',
    help: 'اعلان برای کاربران با نقش زیباگر ارسال می‌شود.',
  },
  {
    key: 'never_notified',
    label: 'بدون اعلان قبلی',
    help: 'فقط کسانی که هنوز هیچ اعلان درون‌برنامه‌ای نگرفته‌اند.',
  },
  {
    key: 'has_paid',
    label: 'دارای پرداخت موفق',
    help: 'فقط کسانی که حداقل یک پرداخت موفق داشته‌اند.',
  },
  {
    key: 'all',
    label: 'همه کاربران',
    help: 'تا سقف ۵۰۰ نفر از همه کاربران فعال.',
  },
];

const TEMPLATES: { label: string; title: string; body: string }[] = [
  {
    label: 'اطلاع عمومی',
    title: 'اطلاعیه مهم',
    body: 'کاربر گرامی، یک اطلاعیه مهم از طرف پشتیبانی بیوتی‌جو برای شما ارسال شده است.',
  },
  {
    label: 'به‌روزرسانی',
    title: 'به‌روزرسانی سامانه',
    body: 'بخش‌هایی از سامانه به‌روزرسانی شده است. در صورت نیاز جزئیات را در پنل خود ببینید.',
  },
  {
    label: 'پشتیبانی',
    title: 'پیام پشتیبانی',
    body: 'تیم پشتیبانی بیوتی‌جو پیامی برای شما دارد. لطفاً در اولین فرصت پنل را بررسی کنید.',
  },
];

function statusLabel(status: string) {
  if (status === 'failed') return 'ناموفق';
  if (status === 'read') return 'خوانده‌شده';
  return 'ارسال‌شده';
}

function statusClass(status: string) {
  if (status === 'failed') return 'text-red-700 bg-red-50';
  if (status === 'read') return 'text-blue-700 bg-blue-50';
  return 'text-emerald-700 bg-emerald-50';
}

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<AdminNotificationCampaign[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [target, setTarget] = useState<TargetKey>('customers');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const [active, setActive] = useState<AdminNotificationCampaign | null>(null);
  const [recipients, setRecipients] = useState<AdminCampaignRecipient[]>([]);
  const [recMeta, setRecMeta] = useState({ total: 0 });
  const [recFilter, setRecFilter] = useState('');
  const [recLoading, setRecLoading] = useState(false);

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
    void load();
  }, [load]);

  const summary = useMemo(() => {
    let failed = 0;
    let read = 0;
    let sent = 0;
    for (const c of items) {
      failed += Number(c.failed) || 0;
      read += Number(c.read) || 0;
      sent += Number(c.sent) || 0;
    }
    return {
      campaigns: meta.total || items.length,
      sent,
      failed,
      read,
    };
  }, [items, meta.total]);

  const targetHelp = TARGETS.find((t) => t.key === target)?.help ?? '';

  const openCompose = () => {
    setTitle('');
    setBody('');
    setTarget('customers');
    setComposeOpen(true);
    setToast(null);
  };

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setTitle(t.title);
    setBody(t.body);
  };

  const buildFilters = (): Record<string, unknown> => {
    const filters: Record<string, unknown> = {};
    if (target === 'customers') filters.accountType = 'customer';
    if (target === 'professionals') filters.accountType = 'professional';
    if (target === 'never_notified') filters.neverNotified = true;
    if (target === 'has_paid') filters.hasPaid = true;
    // target === 'all' → no extra filters
    return filters;
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      setToast({ type: 'err', text: 'عنوان و متن اعلان را پر کنید.' });
      return;
    }
    const audience = TARGETS.find((t) => t.key === target)?.label ?? 'گیرندگان';
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`اعلان برای «${audience}» ارسال شود؟\n\nعنوان: ${title.trim()}`)
    ) {
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      const res = await adminNotifyByFilter({
        title: title.trim(),
        body: body.trim(),
        limit: 500,
        filters: buildFilters(),
      });
      setToast({
        type: 'ok',
        text: `ارسال انجام شد: ${res.notified} نفر` +
          (res.failed ? ` · ناموفق: ${res.failed}` : ''),
      });
      setComposeOpen(false);
      setTitle('');
      setBody('');
      await load();
    } catch (e) {
      setToast({ type: 'err', text: friendlyApiError(e) });
    } finally {
      setBusy(false);
    }
  };

  const openCampaign = async (c: AdminNotificationCampaign, status = '') => {
    setActive(c);
    setRecFilter(status);
    setRecLoading(true);
    try {
      const res = await fetchAdminCampaignRecipients(c.campaignId, {
        status: status || undefined,
        page: 1,
        limit: 50,
      });
      setRecipients(res.items || []);
      setRecMeta({ total: res.meta?.total ?? (res.items || []).length });
    } catch (e) {
      setToast({ type: 'err', text: friendlyApiError(e) });
    } finally {
      setRecLoading(false);
    }
  };

  const retryFailed = async (campaignId: string) => {
    setBusy(true);
    try {
      const res = await adminRetryFailedCampaign(campaignId);
      setToast({
        type: 'ok',
        text: `تلاش مجدد: ${res.retried} از ${res.totalFailed ?? res.retried}`,
      });
      await load();
      if (active?.campaignId === campaignId) {
        await openCampaign(active, recFilter);
      }
    } catch (e) {
      setToast({ type: 'err', text: friendlyApiError(e) });
    } finally {
      setBusy(false);
    }
  };

  if (loading && items.length === 0) return <PanelLoading />;
  if (error && items.length === 0) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">اعلان‌ها</h1>
          <p className="mt-1 text-sm text-gray-500">
            ارسال پیام به کاربران و پیگیری تاریخچه ارسال
          </p>
        </div>
        <button
          type="button"
          onClick={() => (composeOpen ? setComposeOpen(false) : openCompose())}
          className="rounded-xl bg-coral px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
        >
          {composeOpen ? 'بستن فرم' : 'ارسال اعلان جدید'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500">تعداد کمپین‌ها</p>
          <p className="mt-1 text-2xl font-bold">{summary.campaigns.toLocaleString('fa-IR')}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">ارسال‌شده (این صفحه)</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{summary.sent.toLocaleString('fa-IR')}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">خوانده‌شده (این صفحه)</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{summary.read.toLocaleString('fa-IR')}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">ناموفق (این صفحه)</p>
          <p className="mt-1 text-2xl font-bold text-red-700">{summary.failed.toLocaleString('fa-IR')}</p>
        </Card>
      </div>

      {toast && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            toast.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <span>{toast.text}</span>
          <button type="button" className="shrink-0 text-xs underline" onClick={() => setToast(null)}>
            بستن
          </button>
        </div>
      )}

      {/* Compose */}
      {composeOpen && (
        <Card className="border-coral/30 p-5 shadow-sm">
          <h2 className="text-lg font-bold">ارسال اعلان جدید</h2>
          <p className="mt-1 text-sm text-gray-500">سه قدم ساده: مخاطب → متن → تأیید</p>

          <div className="mt-5 space-y-5">
            {/* Step 1 */}
            <section>
              <p className="mb-2 text-xs font-semibold text-gray-500">۱. مخاطب</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TARGETS.map((t) => (
                  <label
                    key={t.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      target === t.key
                        ? 'border-coral bg-coral/5 ring-1 ring-coral/30'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="target"
                      className="mt-1"
                      checked={target === t.key}
                      onChange={() => setTarget(t.key)}
                    />
                    <span>
                      <span className="block text-sm font-medium">{t.label}</span>
                      <span className="mt-0.5 block text-xs text-gray-500">{t.help}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">{targetHelp}</p>
            </section>

            {/* Step 2 */}
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-500">۲. متن پیام</p>
                <div className="flex flex-wrap gap-1">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">عنوان</label>
                  <input
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-coral"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثلاً: اطلاعیه مهم"
                    maxLength={120}
                  />
                </div>
                <div>
                  <div className="mb-1 flex justify-between">
                    <label className="text-xs text-gray-600">متن</label>
                    <span className="text-[11px] text-gray-400">{body.length.toLocaleString('fa-IR')} کاراکتر</span>
                  </div>
                  <textarea
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-coral"
                    rows={4}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="پیام را کوتاه و واضح بنویسید…"
                    maxLength={1000}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                اعلان به‌صورت درون‌برنامه برای گیرندگان ثبت می‌شود (حداکثر ۵۰۰ نفر در هر ارسال).
              </p>
            </section>

            {/* Step 3 */}
            <section className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500">۳. بعد از تأیید، ارسال شروع می‌شود</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                  onClick={() => setComposeOpen(false)}
                  disabled={busy}
                >
                  انصراف
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-coral px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() => void send()}
                  disabled={busy || !title.trim() || !body.trim()}
                >
                  {busy ? 'در حال ارسال…' : 'تأیید و ارسال'}
                </button>
              </div>
            </section>
          </div>
        </Card>
      )}

      {/* History */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">تاریخچه ارسال</h2>
            <p className="text-xs text-gray-500">روی هر ردیف کلیک کنید تا گیرندگان را ببینید</p>
          </div>
          <div className="flex gap-2">
            <input
              className="w-44 rounded-xl border border-gray-200 px-3 py-2 text-sm sm:w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  void load();
                }
              }}
              placeholder="جستجو در عنوان…"
            />
            <button
              type="button"
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
              onClick={() => {
                setPage(1);
                void load();
              }}
            >
              جستجو
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <PanelEmpty title="هنوز اعلانی ارسال نشده" description="با دکمه «ارسال اعلان جدید» اولین پیام را بفرستید." />
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <Card
                key={c.campaignId}
                className="cursor-pointer p-4 transition hover:border-coral/40 hover:shadow-sm"
                onClick={() => void openCampaign(c)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{c.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-gray-500">{c.body}</p>
                    <p className="mt-2 text-xs text-gray-400">{formatDateTime(c.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1">
                      {Number(c.total).toLocaleString('fa-IR')} نفر
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
                      ارسال {Number(c.sent).toLocaleString('fa-IR')}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-800">
                      خوانده {Number(c.read).toLocaleString('fa-IR')}
                    </span>
                    {Number(c.failed) > 0 && (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-800">
                        ناموفق {Number(c.failed).toLocaleString('fa-IR')}
                      </span>
                    )}
                  </div>
                </div>
                {Number(c.failed) > 0 && (
                  <div className="mt-3 flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs text-orange-900 hover:bg-orange-100 disabled:opacity-50"
                      onClick={() => void retryFailed(c.campaignId)}
                    >
                      تلاش مجدد برای ناموفق‌ها
                    </button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2 text-sm">
            <button
              type="button"
              className="rounded-lg border px-3 py-1 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              قبلی
            </button>
            <span className="text-gray-600">
              صفحه {page.toLocaleString('fa-IR')} از {meta.totalPages.toLocaleString('fa-IR')}
            </span>
            <button
              type="button"
              className="rounded-lg border px-3 py-1 disabled:opacity-40"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </button>
          </div>
        )}
      </section>

      {/* Recipients drawer */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setActive(null)}
          role="presentation"
        >
          <div
            className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="border-b border-gray-100 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold">{active.title}</h2>
                  <p className="mt-1 text-xs text-gray-400">{formatDateTime(active.createdAt)}</p>
                </div>
                <button type="button" className="text-sm text-gray-500 underline" onClick={() => setActive(null)}>
                  بستن
                </button>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-gray-600">{active.body}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-gray-100 px-2.5 py-1">
                  کل {Number(active.total).toLocaleString('fa-IR')}
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">
                  ارسال {Number(active.sent).toLocaleString('fa-IR')}
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-800">
                  خوانده {Number(active.read).toLocaleString('fa-IR')}
                </span>
              </div>
            </div>

            <div className="border-b border-gray-100 px-5 py-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { v: '', l: 'همه' },
                  { v: 'sent', l: 'ارسال‌شده' },
                  { v: 'read', l: 'خوانده‌شده' },
                  { v: 'failed', l: 'ناموفق' },
                ].map((t) => (
                  <button
                    key={t.v || 'all'}
                    type="button"
                    className={`rounded-full px-3 py-1 text-xs ${
                      recFilter === t.v
                        ? 'bg-coral text-white'
                        : 'border border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => void openCampaign(active, t.v)}
                  >
                    {t.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {recLoading ? (
                <PanelLoading />
              ) : recipients.length === 0 ? (
                <p className="text-sm text-gray-500">گیرنده‌ای در این فیلتر نیست.</p>
              ) : (
                <ul className="space-y-2">
                  {recipients.map((r) => (
                    <li key={r.id} className="rounded-xl border border-gray-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">
                          {r.displayName || r.phone || r.userId.slice(0, 8)}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClass(r.status)}`}>
                          {statusLabel(r.status)}
                        </span>
                      </div>
                      {r.phone ? (
                        <p className="mt-1 text-xs text-gray-400" dir="ltr">
                          {r.phone}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-gray-400">
                نمایش {recipients.length.toLocaleString('fa-IR')} از {recMeta.total.toLocaleString('fa-IR')}
              </p>
            </div>

            {Number(active.failed) > 0 && (
              <div className="border-t border-gray-100 p-4">
                <button
                  type="button"
                  disabled={busy}
                  className="w-full rounded-xl border border-orange-200 bg-orange-50 py-2.5 text-sm text-orange-900 hover:bg-orange-100 disabled:opacity-50"
                  onClick={() => void retryFailed(active.campaignId)}
                >
                  تلاش مجدد برای ناموفق‌ها ({Number(active.failed).toLocaleString('fa-IR')})
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
