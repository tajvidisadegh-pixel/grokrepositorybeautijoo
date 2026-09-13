'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatDate } from '@/lib/utils';

type MediaItem = {
  id: string;
  kind: string;
  status: string;
  url: string;
  storageKey?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  sortOrder?: number;
  createdAt: string;
  professionalId?: string | null;
  professional?: {
    id: string;
    title?: string | null;
    slug?: string | null;
    user?: { profile?: { displayName?: string | null } | null } | null;
  } | null;
};

type MediaStats = {
  total: number;
  draft: number;
  published: number;
  totalSizeBytes: number;
  byKind: { kind: string; count: number }[];
};

function formatBytes(n?: number | null) {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const KIND_OPTS = [
  { value: '', label: 'همه انواع' },
  { value: 'avatar', label: 'آواتار' },
  { value: 'cover', label: 'کاور' },
  { value: 'logo', label: 'لوگو' },
  { value: 'portfolio', label: 'نمونه کار' },
  { value: 'service', label: 'خدمت' },
];

const STATUS_OPTS = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'published', label: 'منتشر' },
];

export default function AdminMediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 24, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<MediaItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', '24');
      if (search.trim()) qs.set('search', search.trim());
      if (kind) qs.set('kind', kind);
      if (status) qs.set('status', status);
      const [list, st] = await Promise.all([
        apiClient.get<{ items: MediaItem[]; meta: typeof meta }>(`/admin/media?${qs}`),
        apiClient.get<MediaStats>('/admin/media-stats').catch(() => null),
      ]);
      setItems(list.items || []);
      setMeta(list.meta || { page, limit: 24, total: list.items?.length || 0, totalPages: 1 });
      if (st) setStats(st);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [page, search, kind, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatusOf = async (id: string, next: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.patch(`/admin/media/${id}/status`, { status: next });
      setMsg('وضعیت رسانه به‌روز شد');
      await load();
      if (detail?.id === id) {
        const d = await apiClient.get<MediaItem>(`/admin/media`).catch(() => null);
        setDetail((prev) => (prev ? { ...prev, status: next } : prev));
      }
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('آیا از حذف این رسانه مطمئن هستید؟')) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.delete(`/admin/media/${id}`);
      setMsg('رسانه حذف شد');
      setDetail(null);
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
      <div>
        <h1 className="text-2xl font-bold">رسانه‌ها</h1>
        <p className="mt-1 text-sm text-gray">کتابخانه رسانه واقعی سیستم Beautijoo</p>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gray-50 p-4">
            <p className="text-xs text-gray">کل رسانه</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50 p-4">
            <p className="text-xs text-yellow-700">پیش‌نویس</p>
            <p className="text-2xl font-bold text-yellow-800">{stats.draft}</p>
          </Card>
          <Card className="border-green-200 bg-green-50 p-4">
            <p className="text-xs text-green-700">منتشرشده</p>
            <p className="text-2xl font-bold text-green-800">{stats.published}</p>
          </Card>
          <Card className="border-blue-200 bg-blue-50 p-4">
            <p className="text-xs text-blue-700">حجم کل</p>
            <p className="text-lg font-bold text-blue-800">{formatBytes(stats.totalSizeBytes)}</p>
          </Card>
        </div>
      )}

      {msg && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm">
          {msg}
          <button type="button" className="mr-3 text-xs underline" onClick={() => setMsg(null)}>
            بستن
          </button>
        </div>
      )}

      <Card className="space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="جستجو در URL / key / MIME"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
          />
          <select className="rounded-xl border px-3 py-2 text-sm" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
            {KIND_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select className="rounded-xl border px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            {STATUS_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="button" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white" onClick={() => { setPage(1); load(); }}>
            اعمال فیلتر
          </button>
        </div>
      </Card>

      {items.length === 0 ? (
        <PanelEmpty title="رسانه‌ای یافت نشد" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((m) => (
            <Card
              key={m.id}
              className="cursor-pointer overflow-hidden transition hover:shadow-md"
              onClick={() => setDetail(m)}
            >
              <div className="aspect-video bg-gray-light">
                {(m.mimeType || '').startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(m.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray">{m.kind}</div>
                )}
              </div>
              <div className="space-y-1 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{m.kind}</span>
                  <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[10px] text-coral">{m.status}</span>
                </div>
                <p className="text-xs text-gray">{formatBytes(m.sizeBytes)} · {formatDate(m.createdAt, { style: 'short' })}</p>
                {m.professional && (
                  <p className="truncate text-xs text-gray">
                    {m.professional.user?.profile?.displayName || m.professional.title || 'زیباگر'}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button type="button" className="rounded border px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDetail(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-bold">جزئیات رسانه</h2>
              <button type="button" className="text-sm underline" onClick={() => setDetail(null)}>
                بستن
              </button>
            </div>
            <div className="mb-4 overflow-hidden rounded-xl border bg-gray-light">
              {(detail.mimeType || '').startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(detail.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.url} alt="" className="max-h-64 w-full object-contain" />
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-gray">{detail.mimeType || 'فایل'}</div>
              )}
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-gray">نوع</dt><dd>{detail.kind}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-gray">وضعیت</dt><dd>{detail.status}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-gray">حجم</dt><dd>{formatBytes(detail.sizeBytes)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-gray">MIME</dt><dd className="truncate">{detail.mimeType || '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-gray">تاریخ</dt><dd>{formatDate(detail.createdAt, { style: 'long', includeTime: true })}</dd></div>
              {detail.professional && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray">زیباگر</dt>
                  <dd>
                    <Link className="text-coral underline" href={`/admin/professionals/${detail.professional.id}`}>
                      {detail.professional.user?.profile?.displayName || detail.professional.title || 'پروفایل'}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-3 break-all text-xs text-gray" dir="ltr">{detail.url}</p>
            {detail.storageKey && <p className="mt-1 break-all text-xs text-gray" dir="ltr">key: {detail.storageKey}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={detail.url} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-1.5 text-xs">
                مشاهده / دانلود
              </a>
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-xs"
                onClick={() => {
                  void navigator.clipboard?.writeText(detail.url);
                  setMsg('آدرس کپی شد');
                }}
              >
                کپی URL
              </button>
              {detail.status !== 'published' && (
                <button type="button" className="rounded-lg border border-green-400 px-3 py-1.5 text-xs text-green-700" disabled={busy} onClick={() => setStatusOf(detail.id, 'published')}>
                  انتشار
                </button>
              )}
              {detail.status !== 'draft' && (
                <button type="button" className="rounded-lg border px-3 py-1.5 text-xs" disabled={busy} onClick={() => setStatusOf(detail.id, 'draft')}>
                  پیش‌نویس
                </button>
              )}
              <button type="button" className="rounded-lg border border-red-400 px-3 py-1.5 text-xs text-red-700" disabled={busy} onClick={() => remove(detail.id)}>
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
