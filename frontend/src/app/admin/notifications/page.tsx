'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchAdminNotificationCampaigns,
  fetchAdminCampaignRecipients,
  adminRetryFailedCampaign,
  adminNotifyByFilter,
  type AdminNotificationCampaign,
  type AdminCampaignRecipient,
} from '@/lib/panel-api';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatDateTime } from '@/lib/utils';

type TabKey = 'sent' | 'inbox';
type TargetKey = 'customers' | 'professionals' | 'never_notified' | 'has_paid' | 'all';
type CampaignFilter = 'all' | 'failed' | 'ok';

type InboxTicket = {
  id: string;
  subject: string;
  status: string;
  updatedAt: string;
  messageCount?: number;
  lastPreview?: string | null;
  user?: {
    displayName?: string | null;
    phone?: string | null;
    accountType?: string | null;
  } | null;
};

const TARGETS: { key: TargetKey; label: string; help: string }[] = [
  { key: 'customers', label: 'مشتریان', help: 'کاربران با نقش مشتری' },
  { key: 'professionals', label: 'زیباگرها', help: 'کاربران با نقش زیباگر' },
  { key: 'has_paid', label: 'دارای پرداخت', help: 'حداقل یک پرداخت موفق' },
  { key: 'never_notified', label: 'بدون اعلان قبلی', help: 'هنوز اعلان نگرفته‌اند' },
  { key: 'all', label: 'همه کاربران', help: 'تا سقف ۵۰۰ نفر' },
];

const TEMPLATES = [
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
  if (status === 'failed') return 'bg-red-50 text-red-700';
  if (status === 'read') return 'bg-blue-50 text-blue-700';
  return 'bg-emerald-50 text-emerald-700';
}

function ticketStatusFa(s: string) {
  if (s === 'open') return 'باز';
  if (s === 'answered') return 'پاسخ‌داده‌شده';
  if (s === 'closed') return 'بسته';
  return s;
}

function accountTypeFa(t?: string | null) {
  if (t === 'professional') return 'زیباگر';
  if (t === 'customer') return 'مشتری';
  return 'کاربر';
}

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<TabKey>('sent');

  const [items, setItems] = useState<AdminNotificationCampaign[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [campaignFilter, setCampaignFilter] = useState<CampaignFilter>('all');
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

  const [inbox, setInbox] = useState<InboxTicket[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [inboxStatus, setInboxStatus] = useState<'all' | 'open' | 'answered' | 'closed'>('open');

  const loadCampaigns = useCallback(async () => {
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

  const loadInbox = useCallback(async () => {
    setInboxLoading(true);
    setInboxError(null);
    try {
      const q =
        inboxStatus && inboxStatus !== 'all' ? `&status=${encodeURIComponent(inboxStatus)}` : '';
      const res = await apiClient.get<{ items?: InboxTicket[] }>(`/support/tickets/all?page=1${q}`);
      setInbox(Array.isArray(res.items) ? res.items : []);
    } catch (e) {
      setInbox([]);
      setInboxError(friendlyApiError(e));
    } finally {
      setInboxLoading(false);
    }
  }, [inboxStatus]);

  useEffect(() => {
    if (tab === 'sent') void loadCampaigns();
  }, [tab, loadCampaigns]);

  useEffect(() => {
    if (tab === 'inbox') void loadInbox();
  }, [tab, loadInbox]);

  const filteredItems = useMemo(() => {
    if (campaignFilter === 'failed') return items.filter((c) => Number(c.failed) > 0);
    if (campaignFilter === 'ok') return items.filter((c) => Number(c.failed) === 0);
    return items;
  }, [items, campaignFilter]);

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
      inboxOpen: inbox.filter((t) => t.status === 'open').length,
    };
  }, [items, meta.total, inbox]);

  const openCompose = () => {
    setTitle('');
    setBody('');
    setTarget('customers');
    setComposeOpen(true);
    setToast(null);
  };

  const buildFilters = (): Record<string, unknown> => {
    const filters: Record<string, unknown> = {};
    if (target === 'customers') filters.accountType = 'customer';
    if (target === 'professionals') filters.accountType = 'professional';
    if (target === 'never_notified') filters.neverNotified = true;
    if (target === 'has_paid') filters.hasPaid = true;
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
        text:
          `ارسال انجام شد: ${Number(res.notified || 0).toLocaleString('fa-IR')} نفر` +
          (res.failed ? ` · ناموفق: ${Number(res.failed).toLocaleString('fa-IR')}` : ''),
      });
      setComposeOpen(false);
      setTitle('');
      setBody('');
      setTab('sent');
      await loadCampaigns();
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
      await loadCampaigns();
      if (active?.campaignId === campaignId) await openCampaign(active, recFilter);
    } catch (e) {
      setToast({ type: 'err', text: friendlyApiError(e) });
    } finally {
      setBusy(false);
    }
  };

  if (tab === 'sent' && loading && items.length === 0) return <PanelLoading />;
  if (tab === 'sent' && error && items.length === 0)
    return <PanelError message={error} onRetry={() => void loadCampaigns()} />;

  return (
    <div className="mx-auto max-w-5xl space-y-5" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">اعلان‌ها و پیام‌ها</h1>
          <p className="mt-1 text-sm text-gray-500">
            ارسال‌شده‌ها به‌صورت کمپین · دریافتی‌ها از پشتیبانی
          </p>
        </div>
        {tab === 'sent' && (
          <Button size="sm" onClick={() => (composeOpen ? setComposeOpen(false) : openCompose())}>
            {composeOpen ? 'بستن فرم' : 'اعلان جدید'}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => {
            setTab('sent');
            setActive(null);
          }}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            tab === 'sent' ? 'bg-coral text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          ارسال‌شده‌ها
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('inbox');
            setActive(null);
            setComposeOpen(false);
          }}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            tab === 'inbox' ? 'bg-coral text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          دریافتی‌ها (پشتیبانی)
        </button>
        <Link
          href="/admin/support"
          className="mr-auto rounded-full border border-border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          صفحه کامل پشتیبانی
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="p-3">
          <p className="text-[11px] text-gray-500">کمپین‌ها</p>
          <p className="text-xl font-bold">{Number(summary.campaigns).toLocaleString('fa-IR')}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-gray-500">ارسال (این صفحه)</p>
          <p className="text-xl font-bold text-emerald-700">
            {Number(summary.sent).toLocaleString('fa-IR')}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-gray-500">ناموفق</p>
          <p className="text-xl font-bold text-red-700">
            {Number(summary.failed).toLocaleString('fa-IR')}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-gray-500">تیکت باز (بارگذاری‌شده)</p>
          <p className="text-xl font-bold text-amber-700">
            {Number(summary.inboxOpen).toLocaleString('fa-IR')}
          </p>
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
          <button type="button" className="text-xs underline" onClick={() => setToast(null)}>
            بستن
          </button>
        </div>
      )}

      {/* Compose */}
      {tab === 'sent' && composeOpen && (
        <Card className="space-y-4 border-coral/30 p-5">
          <h2 className="font-bold">ارسال اعلان جدید</h2>
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-500">مخاطب</p>
            <div className="flex flex-wrap gap-2">
              {TARGETS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTarget(t.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    target === t.key
                      ? 'border-coral bg-coral text-white'
                      : 'border-border bg-white text-gray-700'
                  }`}
                  title={t.help}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              {TARGETS.find((t) => t.key === target)?.help}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setTitle(t.title);
                  setBody(t.body);
                }}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] hover:bg-gray-50"
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-coral"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان"
            maxLength={120}
          />
          <textarea
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-coral"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="متن اعلان…"
            maxLength={1000}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" loading={busy} disabled={!title.trim() || !body.trim()} onClick={() => void send()}>
              تأیید و ارسال
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setComposeOpen(false)}>
              انصراف
            </Button>
          </div>
        </Card>
      )}

      {/* SENT TAB */}
      {tab === 'sent' && !active && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['all', 'همه کمپین‌ها'],
                ['failed', 'دارای ناموفق'],
                ['ok', 'بدون خطا'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setCampaignFilter(k)}
                className={`rounded-full px-3 py-1 text-xs ${
                  campaignFilter === k
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
            <div className="mr-auto flex gap-2">
              <input
                className="w-40 rounded-xl border border-gray-200 px-3 py-1.5 text-sm sm:w-52"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    void loadCampaigns();
                  }
                }}
                placeholder="جستجوی عنوان…"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPage(1);
                  void loadCampaigns();
                }}
              >
                جستجو
              </Button>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <PanelEmpty
              title="کمپینی نیست"
              description="با «اعلان جدید» اولین ارسال را انجام دهید."
              action={
                <Button size="sm" onClick={openCompose}>
                  اعلان جدید
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {filteredItems.map((c) => (
                <li key={c.campaignId}>
                  <button type="button" className="w-full text-right" onClick={() => void openCampaign(c)}>
                    <Card className="space-y-2 p-4 transition hover:border-coral/40">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{c.title}</p>
                          <p className="mt-0.5 line-clamp-1 text-sm text-gray-500">{c.body}</p>
                          <p className="mt-1 text-xs text-gray-400">{formatDateTime(c.createdAt)}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5">
                            {Number(c.total).toLocaleString('fa-IR')} نفر
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">
                            ارسال {Number(c.sent).toLocaleString('fa-IR')}
                          </span>
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-800">
                            خوانده {Number(c.read).toLocaleString('fa-IR')}
                          </span>
                          {Number(c.failed) > 0 && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-800">
                              ناموفق {Number(c.failed).toLocaleString('fa-IR')}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-coral">مشاهده گیرندگان ←</p>
                    </Card>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                قبلی
              </Button>
              <span className="text-xs text-gray">
                {page.toLocaleString('fa-IR')} / {meta.totalPages.toLocaleString('fa-IR')}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                بعدی
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Campaign detail */}
      {tab === 'sent' && active && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="outline" onClick={() => setActive(null)}>
              ← بازگشت به کمپین‌ها
            </Button>
            {Number(active.failed) > 0 && (
              <Button size="sm" variant="outline" loading={busy} onClick={() => void retryFailed(active.campaignId)}>
                تلاش مجدد ناموفق‌ها
              </Button>
            )}
          </div>
          <Card className="space-y-2 p-4">
            <h2 className="text-lg font-bold">{active.title}</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{active.body}</p>
            <p className="text-xs text-gray-400">{formatDateTime(active.createdAt)}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-gray-100 px-2 py-1">
                کل {Number(active.total).toLocaleString('fa-IR')}
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-800">
                ارسال {Number(active.sent).toLocaleString('fa-IR')}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-800">
                خوانده {Number(active.read).toLocaleString('fa-IR')}
              </span>
              <span className="rounded-full bg-red-50 px-2 py-1 text-red-800">
                ناموفق {Number(active.failed).toLocaleString('fa-IR')}
              </span>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            {['', 'sent', 'read', 'failed'].map((s) => (
              <button
                key={s || 'all'}
                type="button"
                onClick={() => void openCampaign(active, s)}
                className={`rounded-full px-3 py-1 text-xs ${
                  recFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {s === '' ? 'همه گیرندگان' : statusLabel(s)}
              </button>
            ))}
          </div>

          {recLoading ? (
            <PanelLoading />
          ) : recipients.length === 0 ? (
            <PanelEmpty title="گیرنده‌ای نیست" description="با این فیلتر موردی پیدا نشد." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[480px] text-right text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">نام</th>
                    <th className="px-3 py-2 font-medium">تلفن</th>
                    <th className="px-3 py-2 font-medium">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2">{r.displayName || '—'}</td>
                      <td className="px-3 py-2" dir="ltr">
                        {r.phone || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClass(r.status)}`}>
                          {statusLabel(r.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-border px-3 py-2 text-xs text-gray">
                نمایش {recipients.length.toLocaleString('fa-IR')} از{' '}
                {Number(recMeta.total).toLocaleString('fa-IR')}
              </p>
            </div>
          )}
        </section>
      )}

      {/* INBOX TAB */}
      {tab === 'inbox' && (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['all', 'open', 'answered', 'closed'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInboxStatus(s)}
                className={`rounded-full px-3 py-1 text-xs ${
                  inboxStatus === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {s === 'all' ? 'همه' : ticketStatusFa(s)}
              </button>
            ))}
          </div>

          {inboxLoading ? (
            <PanelLoading />
          ) : inboxError ? (
            <PanelError message={inboxError} onRetry={() => void loadInbox()} />
          ) : inbox.length === 0 ? (
            <PanelEmpty title="پیام دریافتی نیست" description="تیکت پشتیبانی با این فیلتر وجود ندارد." />
          ) : (
            <ul className="space-y-2">
              {inbox.map((t) => {
                const name = t.user?.displayName || t.user?.phone || '—';
                return (
                  <li key={t.id}>
                    <Link href="/admin/support" className="block">
                      <Card className="space-y-1 p-4 transition hover:border-coral/40">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold">{t.subject}</p>
                          <span className="text-xs text-gray">{ticketStatusFa(t.status)}</span>
                        </div>
                        <p className="text-sm text-gray">
                          {name}
                          <span className="text-xs text-gray-400">
                            {' '}
                            · {accountTypeFa(t.user?.accountType)}
                            {t.user?.phone ? (
                              <span dir="ltr"> · {t.user.phone}</span>
                            ) : null}
                          </span>
                        </p>
                        {t.lastPreview ? (
                          <p className="line-clamp-1 text-sm text-gray-500">{t.lastPreview}</p>
                        ) : null}
                        <p className="text-xs text-gray-400">
                          {formatDateTime(t.updatedAt)}
                          {t.messageCount != null
                            ? ` · ${Number(t.messageCount).toLocaleString('fa-IR')} پیام`
                            : ''}
                        </p>
                        <p className="text-[11px] text-coral">پاسخ در پشتیبانی ←</p>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
