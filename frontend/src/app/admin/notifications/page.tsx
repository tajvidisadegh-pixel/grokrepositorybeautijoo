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
  { key: 'customers', label: 'کاربران', help: 'کاربران عادی (نوبت‌گیرنده)' },
  { key: 'professionals', label: 'زیباگرها', help: 'کاربران با نقش زیباگر' },
  { key: 'has_paid', label: 'دارای پرداخت', help: 'حداقل یک پرداخت موفق' },
  { key: 'never_notified', label: 'بدون اعلان قبلی', help: 'هنوز اعلان درون‌برنامه‌ای نگرفته‌اند' },
  { key: 'all', label: 'همه کاربران', help: 'تا سقف ۵۰۰ نفر از کاربران فعال' },
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
    label: 'تخفیف / پیشنهاد',
    title: 'پیشنهاد ویژه بیوتی‌جو',
    body: 'یک پیشنهاد ویژه برای شما آماده است. همین حالا در اپ یا سایت بیوتی‌جو جزئیات را ببینید.',
  },
  {
    label: 'یادآوری رزرو',
    title: 'یادآوری نوبت',
    body: 'یادآوری: نوبت‌های نزدیک خود را در پنل بررسی کنید تا به‌موقع حاضر شوید.',
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
  if (t === 'customer') return 'کاربر';
  return 'کاربر';
}

function successRate(c: AdminNotificationCampaign) {
  const total = Number(c.total) || 0;
  const sent = Number(c.sent) || 0;
  if (total <= 0) return null;
  return Math.round((sent / total) * 100);
}

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<TabKey>('sent');

  const [items, setItems] = useState<AdminNotificationCampaign[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
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
  const [sendSms, setSendSms] = useState(false);

  const [active, setActive] = useState<AdminNotificationCampaign | null>(null);
  const [recipients, setRecipients] = useState<AdminCampaignRecipient[]>([]);
  const [recMeta, setRecMeta] = useState({ total: 0 });
  const [recFilter, setRecFilter] = useState('');
  const [recLoading, setRecLoading] = useState(false);

  const [inbox, setInbox] = useState<InboxTicket[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [inboxStatus, setInboxStatus] = useState<'all' | 'open' | 'answered' | 'closed'>('open');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminNotificationCampaigns(page, 20, search || undefined);
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
    setSendSms(false);
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
    const smsHint = sendSms ? '\n(همراه با پیامک)' : '';
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`اعلان برای «${audience}» ارسال شود؟${smsHint}\n\nعنوان: ${title.trim()}`)
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
        sms: sendSms || undefined,
      });
      const parts = [
        `ارسال انجام شد: ${Number(res.notified || 0).toLocaleString('fa-IR')} نفر`,
      ];
      if (res.failed) parts.push(`ناموفق: ${Number(res.failed).toLocaleString('fa-IR')}`);
      if (res.smsSent) parts.push(`پیامک: ${Number(res.smsSent).toLocaleString('fa-IR')}`);
      setToast({ type: 'ok', text: parts.join(' · ') });
      setComposeOpen(false);
      setTitle('');
      setBody('');
      setSendSms(false);
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
        text: `تلاش مجدد: ${Number(res.retried).toLocaleString('fa-IR')} از ${Number(res.totalFailed ?? res.retried).toLocaleString('fa-IR')}`,
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
            ارسال گروهی به‌صورت کمپین · پیام‌های پشتیبانی در تب دریافتی
          </p>
        </div>
        {tab === 'sent' && (
          <Button size="sm" onClick={() => (composeOpen ? setComposeOpen(false) : openCompose())}>
            {composeOpen ? 'بستن فرم' : 'اعلان جدید'}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
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
        <Link href="/admin/support" className="mr-auto text-xs text-coral hover:underline">
          صفحه پشتیبانی کامل ←
        </Link>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-950">
        <strong className="font-semibold">راهنما:</strong>{' '}
        تب «ارسال‌شده‌ها» برای کمپین‌های گروهی است (هر کمپین یک کارت). جزئیات گیرندگان فقط با باز کردن
        همان کمپین دیده می‌شود. تب «دریافتی‌ها» تیکت‌های پشتیبانی است؛ برای پاسخ به صفحه پشتیبانی بروید.
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <p className="text-[11px] text-gray-500">کمپین (کل)</p>
          <p className="text-xl font-bold text-gray-900">
            {Number(summary.campaigns).toLocaleString('fa-IR')}
          </p>
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
          <p className="text-[11px] text-gray-500">تیکت باز</p>
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
          <div>
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-coral"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان"
              maxLength={120}
            />
            <p className="mt-1 text-left text-[10px] text-gray-400" dir="ltr">
              {title.length}/120
            </p>
          </div>
          <div>
            <textarea
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-coral"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="متن اعلان…"
              maxLength={1000}
            />
            <p className="mt-1 text-left text-[10px] text-gray-400" dir="ltr">
              {body.length}/1000
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={sendSms}
              onChange={(e) => setSendSms(e.target.checked)}
            />
            <span>
              ارسال هم‌زمان پیامک
              <span className="mt-0.5 block text-[11px] text-gray-500">
                در صورت فعال بودن درگاه SMS، برای گیرندگان پیامک هم فرستاده می‌شود (هزینه‌بر).
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busy}
              disabled={!title.trim() || !body.trim()}
              onClick={() => void send()}
            >
              تأیید و ارسال
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setComposeOpen(false)}>
              انصراف
            </Button>
          </div>
        </Card>
      )}

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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="جستجوی عنوان…"
              />
              <Button size="sm" variant="outline" onClick={() => void loadCampaigns()}>
                بروزرسانی
              </Button>
            </div>
          </div>

          {loading ? (
            <PanelLoading />
          ) : filteredItems.length === 0 ? (
            <PanelEmpty
              title="کمپینی نیست"
              description="با «اعلان جدید» اولین کمپین را بفرستید یا فیلتر را عوض کنید."
            />
          ) : (
            <ul className="space-y-3">
              {filteredItems.map((c) => {
                const rate = successRate(c);
                return (
                  <li key={c.campaignId}>
                    <Card className="overflow-hidden p-0">
                      <button
                        type="button"
                        className="w-full space-y-2 p-4 text-right transition hover:bg-gray-50/80"
                        onClick={() => void openCampaign(c)}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-semibold text-gray-900">{c.title}</p>
                          <span className="text-xs text-gray-400">{formatDateTime(c.createdAt)}</span>
                        </div>
                        <p className="line-clamp-2 text-sm text-gray-600">{c.body}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5">
                            کل: {Number(c.total).toLocaleString('fa-IR')}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">
                            ارسال: {Number(c.sent).toLocaleString('fa-IR')}
                          </span>
                          {Number(c.failed) > 0 && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-800">
                              ناموفق: {Number(c.failed).toLocaleString('fa-IR')}
                            </span>
                          )}
                          {Number(c.read) > 0 && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-800">
                              خوانده: {Number(c.read).toLocaleString('fa-IR')}
                            </span>
                          )}
                          {rate != null && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5">
                              موفقیت: {rate.toLocaleString('fa-IR')}٪
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-coral">مشاهده گیرندگان ←</p>
                      </button>
                      {Number(c.failed) > 0 && (
                        <div className="border-t border-border px-4 py-2">
                          <Button
                            size="sm"
                            variant="outline"
                            loading={busy}
                            onClick={() => void retryFailed(c.campaignId)}
                          >
                            تلاش مجدد ناموفق‌ها
                          </Button>
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
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
              <span className="text-xs text-gray-500">
                صفحه {page.toLocaleString('fa-IR')} از {meta.totalPages.toLocaleString('fa-IR')}
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

      {tab === 'sent' && active && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setActive(null);
                setRecipients([]);
              }}
            >
              ← بازگشت به لیست
            </Button>
            {Number(active.failed) > 0 && (
              <Button
                size="sm"
                variant="outline"
                loading={busy}
                onClick={() => void retryFailed(active.campaignId)}
              >
                تلاش مجدد ناموفق‌ها
              </Button>
            )}
          </div>
          <Card className="space-y-2 p-4">
            <h2 className="text-lg font-bold">{active.title}</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{active.body}</p>
            <p className="text-xs text-gray-400">{formatDateTime(active.createdAt)}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-gray-100 px-2 py-0.5">
                کل: {Number(active.total).toLocaleString('fa-IR')}
              </span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">
                ارسال: {Number(active.sent).toLocaleString('fa-IR')}
              </span>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-800">
                ناموفق: {Number(active.failed).toLocaleString('fa-IR')}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-800">
                خوانده: {Number(active.read).toLocaleString('fa-IR')}
              </span>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ['', 'همه'],
                ['sent', 'ارسال‌شده'],
                ['failed', 'ناموفق'],
                ['read', 'خوانده‌شده'],
              ] as const
            ).map(([s, label]) => (
              <button
                key={s || 'all'}
                type="button"
                onClick={() => void openCampaign(active, s)}
                className={`rounded-full px-3 py-1 text-xs ${
                  recFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
            <span className="self-center text-xs text-gray-400">
              {Number(recMeta.total).toLocaleString('fa-IR')} گیرنده
            </span>
          </div>

          {recLoading ? (
            <PanelLoading />
          ) : recipients.length === 0 ? (
            <PanelEmpty title="گیرنده‌ای نیست" description="با این فیلتر گیرنده‌ای یافت نشد." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">کاربر</th>
                    <th className="px-3 py-2 text-right font-medium">تلفن</th>
                    <th className="px-3 py-2 text-right font-medium">وضعیت</th>
                    <th className="px-3 py-2 text-right font-medium">خطا</th>
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
                        <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(r.status)}`}>
                          {statusLabel(r.status)}
                        </span>
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2 text-xs text-red-600">
                        {r.error || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'inbox' && (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['open', 'answered', 'closed', 'all'] as const).map((s) => (
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
            <Button size="sm" variant="outline" className="mr-auto" onClick={() => void loadInbox()}>
              بروزرسانی
            </Button>
          </div>

          {inboxLoading ? (
            <PanelLoading />
          ) : inboxError ? (
            <PanelError message={inboxError} onRetry={() => void loadInbox()} />
          ) : inbox.length === 0 ? (
            <PanelEmpty
              title="پیام دریافتی نیست"
              description="تیکت پشتیبانی با این فیلتر وجود ندارد."
            />
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
