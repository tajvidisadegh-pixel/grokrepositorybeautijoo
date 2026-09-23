'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { persianBookingStatus } from '@/lib/persian-status';
import { formatDate, formatPrice } from '@/lib/utils';
import { JalaliDateInput } from '@/components/ui/jalali-date-input';

type BookingRow = {
  id: string;
  status: string;
  startAt: string;
  endAt?: string | null;
  totalPrice?: number | null;
  customer?: {
    id: string;
    phone?: string | null;
    profile?: { displayName?: string | null } | null;
  } | null;
  professional?: {
    id: string;
    slug?: string;
    title?: string | null;
    user?: { phone?: string | null; profile?: { displayName?: string | null } | null } | null;
  } | null;
  payment?: {
    id?: string;
    amount?: number | null;
    status?: string;
    providerRef?: string | null;
    paidAt?: string | null;
  } | null;
  items?: Array<{ price?: number; service?: { name?: string } | null }>;
};

type BookingsStats = {
  total: number;
  today: number;
  pending: number;
  completed: number;
  cancelled: number;
  grossRevenue: number;
  platformShare: number;
  commissionRate: number;
  failedPayments: number;
};

const STATUS_OPTS = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'pending', label: 'در انتظار' },
  { value: 'confirmed', label: 'تأییدشده' },
  { value: 'completed', label: 'تکمیل‌شده' },
  { value: 'cancelled', label: 'لغوشده' },
  { value: 'rejected', label: 'ردشده' },
];

const PAY_OPTS = [
  { value: '', label: 'همه پرداخت‌ها' },
  { value: 'paid', label: 'پرداخت‌شده' },
  { value: 'pending', label: 'در انتظار پرداخت' },
  { value: 'failed', label: 'ناموفق' },
  { value: 'cancelled', label: 'لغو پرداخت' },
];

export default function AdminBookingsPage() {
  const [items, setItems] = useState<BookingRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<BookingsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<BookingRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', '20');
    if (search.trim()) p.set('search', search.trim());
    if (status) p.set('status', status);
    if (paymentStatus) p.set('paymentStatus', paymentStatus);
    if (startDate) p.set('startDate', startDate);
    if (endDate) p.set('endDate', endDate);
    return p.toString();
  }, [page, search, status, paymentStatus, startDate, endDate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, st] = await Promise.all([
        apiClient.get<{ items: BookingRow[]; meta: typeof meta }>(`/admin/bookings?${query}`),
        apiClient.get<BookingsStats>('/admin/bookings-stats').catch(() => null),
      ]);
      setItems(list.items || []);
      setMeta(list.meta || { page, limit: 20, total: list.items?.length || 0, totalPages: 1 });
      if (st) setStats(st);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    setReason('');
    try {
      const d = await apiClient.get<BookingRow>(`/admin/bookings/${id}`);
      setDetail(d);
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setDetailLoading(false);
    }
  };

  const changeStatus = async (id: string, next: string) => {
    if (next === 'cancelled' && !reason.trim()) {
      setMsg('برای لغو، دلیل را وارد کنید');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.patch(`/admin/bookings/${id}/status`, { status: next, reason: reason.trim() || undefined });
      setMsg('وضعیت رزرو به‌روز شد');
      await load();
      await openDetail(id);
    } catch (e) {
      setMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const applyQuick = (kind: string) => {
    setPage(1);
    if (kind === 'today') {
      const t = new Date();
      const y = t.toISOString().slice(0, 10);
      setStartDate(y);
      setEndDate(y);
      setStatus('');
      setPaymentStatus('');
    } else if (kind === 'pending') {
      setStatus('pending');
      setStartDate('');
      setEndDate('');
    } else if (kind === 'cancelled') {
      setStatus('cancelled');
    } else if (kind === 'failed_pay') {
      setPaymentStatus('failed');
      setStatus('');
    } else {
      setStatus('');
      setPaymentStatus('');
      setStartDate('');
      setEndDate('');
      setSearch('');
    }
  };

  if (loading && items.length === 0) return <PanelLoading />;
  if (error && items.length === 0) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">رزروها</h1>
        <p className="mt-1 text-sm text-gray">نظارت، پشتیبانی و مدیریت وضعیت رزروها</p>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card className="bg-gray-50 p-4"><p className="text-xs text-gray">کل رزروها</p><p className="text-2xl font-bold">{stats.total}</p></Card>
          <Card className="border-blue-200 bg-blue-50 p-4"><p className="text-xs text-blue-700">امروز</p><p className="text-2xl font-bold text-blue-800">{stats.today}</p></Card>
          <Card className="border-yellow-200 bg-yellow-50 p-4"><p className="text-xs text-yellow-700">در انتظار</p><p className="text-2xl font-bold text-yellow-800">{stats.pending}</p></Card>
          <Card className="border-green-200 bg-green-50 p-4"><p className="text-xs text-green-700">تکمیل‌شده</p><p className="text-2xl font-bold text-green-800">{stats.completed}</p></Card>
          <Card className="border-red-200 bg-red-50 p-4"><p className="text-xs text-red-700">لغوشده</p><p className="text-2xl font-bold text-red-800">{stats.cancelled}</p></Card>
          <Card className="border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs text-emerald-700">درآمد (پرداخت‌شده)</p>
            <p className="text-lg font-bold text-emerald-800">{formatPrice(stats.grossRevenue)}</p>
            <p className="text-[11px] text-gray">سهم پلتفرم ({stats.commissionRate}%): {formatPrice(stats.platformShare)}</p>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        <button type="button" className="rounded-full border px-3 py-1" onClick={() => applyQuick('all')}>همه</button>
        <button type="button" className="rounded-full border px-3 py-1" onClick={() => applyQuick('today')}>امروز</button>
        <button type="button" className="rounded-full border px-3 py-1" onClick={() => applyQuick('pending')}>نیازمند اقدام</button>
        <button type="button" className="rounded-full border px-3 py-1" onClick={() => applyQuick('cancelled')}>لغوشده</button>
        <button type="button" className="rounded-full border px-3 py-1" onClick={() => applyQuick('failed_pay')}>پرداخت مشکل‌دار</button>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm">
          {msg}
          <button type="button" className="mr-3 text-xs underline" onClick={() => setMsg(null)}>بستن</button>
        </div>
      )}

      <Card className="space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="جستجو: نام، موبایل، کد رزرو" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())} />
          <select className="rounded-xl border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="rounded-xl border px-3 py-2 text-sm" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            {PAY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <JalaliDateInput value={startDate} onChange={setStartDate} className="min-w-[10rem]" />
          <JalaliDateInput value={endDate} onChange={setEndDate} className="min-w-[10rem]" />
        </div>
        <button type="button" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white" onClick={() => { setPage(1); load(); }}>اعمال فیلتر</button>
      </Card>

      {items.length === 0 ? (
        <PanelEmpty title="رزروی یافت نشد" />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-light/60 text-right">
              <tr>
                <th className="p-3">کد</th>
                <th className="p-3">مشتری</th>
                <th className="p-3">زیباگر</th>
                <th className="p-3">زمان</th>
                <th className="p-3">مبلغ</th>
                <th className="p-3">پرداخت</th>
                <th className="p-3">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="cursor-pointer border-t hover:bg-gray-light/30" onClick={() => openDetail(b.id)}>
                  <td className="p-3 font-mono text-xs" dir="ltr">#{b.id.slice(0, 8)}</td>
                  <td className="p-3">{b.customer?.profile?.displayName || b.customer?.phone || '—'}</td>
                  <td className="p-3">{b.professional?.user?.profile?.displayName || b.professional?.title || '—'}</td>
                  <td className="p-3">{formatDate(b.startAt, { style: 'short', includeTime: true })}</td>
                  <td className="p-3">{b.totalPrice != null ? formatPrice(b.totalPrice) : '—'}</td>
                  <td className="p-3 text-xs">{b.payment?.status || '—'}</td>
                  <td className="p-3"><span className="rounded-full bg-coral-soft px-2 py-0.5 text-xs text-coral">{persianBookingStatus(b.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button type="button" className="rounded border px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</button>
          <span>صفحه {page} از {meta.totalPages}</span>
          <button type="button" className="rounded border px-3 py-1 disabled:opacity-40" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>بعدی</button>
        </div>
      )}

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => !detailLoading && setDetail(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            {detailLoading ? <PanelLoading /> : detail ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold">جزئیات رزرو</h2>
                    <p className="text-xs text-gray font-mono" dir="ltr">#{detail.id}</p>
                  </div>
                  <button type="button" className="text-sm underline" onClick={() => setDetail(null)}>بستن</button>
                </div>

                <Card className="space-y-2 p-4 text-sm">
                  <h3 className="font-semibold">مشتری</h3>
                  <p>{detail.customer?.profile?.displayName || '—'}</p>
                  <p dir="ltr">{detail.customer?.phone || '—'}</p>
                  {detail.customer?.id && (
                    <Link href={`/admin/users`} className="text-xs text-coral underline">مشاهده مشتریان</Link>
                  )}
                </Card>

                <Card className="space-y-2 p-4 text-sm">
                  <h3 className="font-semibold">زیباگر</h3>
                  <p>{detail.professional?.user?.profile?.displayName || detail.professional?.title || '—'}</p>
                  <p dir="ltr">{detail.professional?.user?.phone || '—'}</p>
                  {detail.professional?.id && (
                    <Link href={`/admin/professionals/${detail.professional.id}`} className="text-xs text-coral underline">پروفایل زیباگر</Link>
                  )}
                </Card>

                <Card className="space-y-2 p-4 text-sm">
                  <h3 className="font-semibold">زمان و خدمت</h3>
                  <p>شروع: {formatDate(detail.startAt, { style: 'long', includeTime: true })}</p>
                  {detail.endAt && <p>پایان: {formatDate(detail.endAt, { style: 'short', includeTime: true })}</p>}
                  {detail.items?.length ? (
                    <ul className="list-disc pr-4">
                      {detail.items.map((it, i) => (
                        <li key={i}>{it.service?.name || 'خدمت'}{it.price != null ? ` — ${formatPrice(it.price)}` : ''}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p>مبلغ کل: {detail.totalPrice != null ? formatPrice(detail.totalPrice) : '—'}</p>
                  <p>وضعیت: {persianBookingStatus(detail.status)}</p>
                </Card>

                <Card className="space-y-2 p-4 text-sm">
                  <h3 className="font-semibold">پرداخت</h3>
                  <p>وضعیت: {detail.payment?.status || '—'}</p>
                  <p>مبلغ: {detail.payment?.amount != null ? formatPrice(detail.payment.amount) : '—'}</p>
                  {detail.payment?.providerRef && <p dir="ltr" className="text-xs">ref: {detail.payment.providerRef}</p>}
                </Card>

                <Card className="space-y-3 p-4">
                  <h3 className="font-semibold text-sm">عملیات پشتیبانی</h3>
                  <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={2} placeholder="دلیل (برای لغو الزامی)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="flex flex-wrap gap-2">
                    {detail.status !== 'confirmed' && (
                      <button type="button" className="rounded-lg border border-green-400 px-3 py-1.5 text-xs text-green-700" disabled={busy} onClick={() => changeStatus(detail.id, 'confirmed')}>تأیید</button>
                    )}
                    {detail.status !== 'completed' && (
                      <button type="button" className="rounded-lg border px-3 py-1.5 text-xs" disabled={busy} onClick={() => changeStatus(detail.id, 'completed')}>تکمیل</button>
                    )}
                    {detail.status !== 'cancelled' && (
                      <button type="button" className="rounded-lg border border-red-400 px-3 py-1.5 text-xs text-red-700" disabled={busy} onClick={() => changeStatus(detail.id, 'cancelled')}>لغو با دلیل</button>
                    )}
                  </div>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}