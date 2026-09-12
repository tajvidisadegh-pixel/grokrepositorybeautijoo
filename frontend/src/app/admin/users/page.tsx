'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchAdminUsers,
  fetchAdminUserDetail,
  adminSetUserStatus,
  adminNotifyUsers,
  adminNotifyByFilter,
  type AdminUser,
  type AdminUserDetail,
  type AdminUserBooking,
  type AdminUsersQuery,
} from '@/lib/panel-api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatDate } from '@/lib/utils';

type StatusFilter = '' | 'active' | 'blocked' | 'inactive';

function formatMoney(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('fa-IR').format(Math.round(n)) + ' تومان';
}

const STATUS_LABEL: Record<string, string> = {
  active: 'فعال',
  blocked: 'مسدود',
  inactive: 'غیرفعال',
  suspended: 'تعلیق',
};

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [city, setCity] = useState('');
  const [bookingPresence, setBookingPresence] = useState<'' | 'any' | 'none' | 'has'>('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');
  const [neverNotified, setNeverNotified] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMode, setNotifyMode] = useState<'selected' | 'filter'>('selected');
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [notifySms, setNotifySms] = useState(false);
  const [notifyTargetIds, setNotifyTargetIds] = useState<string[]>([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentFilters = useMemo((): Omit<AdminUsersQuery, 'page' | 'limit'> => ({
    search: search.trim() || undefined,
    status: status || undefined,
    accountType: 'customer',
    city: city.trim() || undefined,
    bookingPresence: bookingPresence || undefined,
    bookingStatus: bookingStatus || undefined,
    registeredFrom: registeredFrom || undefined,
    registeredTo: registeredTo || undefined,
    neverNotified: neverNotified || undefined,
    hasPaid: hasPaid || undefined,
  }), [search, status, city, bookingPresence, bookingStatus, registeredFrom, registeredTo, neverNotified, hasPaid]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminUsers({
        page,
        limit: 20,
        ...currentFilters,
      });
      setItems(res.items);
      setMeta(res.meta || { page, limit: 20, total: res.items.length, totalPages: 1 });
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [page, currentFilters]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSelect = (id: string) => {
    setSelectAllMatching(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAllMatching || selected.size === items.length) {
      setSelected(new Set());
      setSelectAllMatching(false);
    } else {
      setSelected(new Set(items.map((u) => u.id)));
      setSelectAllMatching(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await fetchAdminUserDetail(id);
      setDetail(d);
    } catch (e) {
      setActionMsg(friendlyApiError(e));
    } finally {
      setDetailLoading(false);
    }
  };

  const changeStatus = async (id: string, newStatus: string) => {
    setBusy(true);
    setActionMsg(null);
    try {
      await adminSetUserStatus(id, newStatus);
      setActionMsg('وضعیت با موفقیت به‌روزرسانی شد');
      await load();
      if (detail?.id === id) await openDetail(id);
    } catch (e) {
      setActionMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const openNotify = (ids: string[], mode: 'selected' | 'filter' = 'selected') => {
    setNotifyTargetIds(ids);
    setNotifyMode(mode);
    setNotifyTitle('');
    setNotifyBody('');
    setNotifySms(false);
    setNotifyOpen(true);
  };

  const sendNotify = async () => {
    if (!notifyTitle.trim() || !notifyBody.trim()) {
      setActionMsg('عنوان و متن اعلان الزامی است');
      return;
    }
    setBusy(true);
    setActionMsg(null);
    try {
      if (notifyMode === 'filter' || selectAllMatching) {
        const res = await adminNotifyByFilter({
          title: notifyTitle.trim(),
          body: notifyBody.trim(),
          sms: notifySms,
          limit: 500,
          filters: currentFilters,
        });
        setActionMsg(
          `اعلان فیلتری برای ${res.notified} مشتری ارسال شد${notifySms ? ` (SMS: ${res.smsSent})` : ''}` +
            (res.campaignId ? ` · کمپین: ${res.campaignId}` : ''),
        );
      } else {
        const res = await adminNotifyUsers({
          userIds: notifyTargetIds,
          title: notifyTitle.trim(),
          body: notifyBody.trim(),
          sms: notifySms,
        });
        setActionMsg(`اعلان برای ${res.notified} مشتری ارسال شد${notifySms ? ` (SMS: ${res.smsSent})` : ''}`);
      }
      setNotifyOpen(false);
      setSelected(new Set());
      setSelectAllMatching(false);
    } catch (e) {
      setActionMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const headerStats = useMemo(() => {
    const active = items.filter((u) => u.status === 'active').length;
    const blocked = items.filter((u) => u.status === 'blocked' || u.status === 'suspended').length;
    return { active, blocked, total: meta.total };
  }, [items, meta.total]);

  if (loading && items.length === 0) return <PanelLoading />;
  if (error && items.length === 0) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مشتریان</h1>
          <p className="mt-1 text-sm text-gray">مدیریت مشتریان، فیلتر پیشرفته، اعلان و وضعیت حساب</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-gray-light px-3 py-1">کل: {headerStats.total}</span>
          <span className="rounded-full bg-green-100 text-green-800 px-3 py-1">فعال در صفحه: {headerStats.active}</span>
          <span className="rounded-full bg-red-100 text-red-800 px-3 py-1">مسدود/تعلیق: {headerStats.blocked}</span>
        </div>
      </div>

      {actionMsg && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm">
          {actionMsg}
          <button type="button" className="mr-3 text-xs underline" onClick={() => setActionMsg(null)}>
            بستن
          </button>
        </div>
      )}

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs text-gray">جستجو (نام / موبایل)</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
            placeholder="نام یا شماره..."
            dir="rtl"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray">وضعیت</label>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="">همه</option>
            <option value="active">فعال</option>
            <option value="blocked">مسدود</option>
            <option value="inactive">غیرفعال</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray">شهر</label>
          <input
            className="w-28 rounded-lg border px-3 py-2 text-sm"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="تهران..."
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray">رزرو</label>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={bookingPresence}
            onChange={(e) => setBookingPresence(e.target.value as '' | 'any' | 'none' | 'has')}
          >
            <option value="">همه</option>
            <option value="has">دارای رزرو</option>
            <option value="none">بدون رزرو</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray">وضعیت رزرو</label>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={bookingStatus}
            onChange={(e) => setBookingStatus(e.target.value)}
          >
            <option value="">همه</option>
            <option value="completed">تکمیل‌شده</option>
            <option value="confirmed">تأییدشده</option>
            <option value="cancelled">لغو</option>
            <option value="pending">در انتظار</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray">عضویت از</label>
          <input type="date" className="rounded-lg border px-2 py-2 text-sm" value={registeredFrom} onChange={(e) => setRegisteredFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray">عضویت تا</label>
          <input type="date" className="rounded-lg border px-2 py-2 text-sm" value={registeredTo} onChange={(e) => setRegisteredTo(e.target.value)} />
        </div>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={neverNotified} onChange={(e) => setNeverNotified(e.target.checked)} />
          هرگز اعلان نگرفته
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={hasPaid} onChange={(e) => setHasPaid(e.target.checked)} />
          پرداخت داشته
        </label>
        <button
          type="button"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => {
            setPage(1);
            load();
          }}
          disabled={loading}
        >
          اعمال فیلتر
        </button>
        {selected.size > 0 && !selectAllMatching && (
          <button
            type="button"
            className="rounded-lg border border-emerald-600 px-4 py-2 text-sm text-emerald-700"
            onClick={() => openNotify(Array.from(selected), 'selected')}
          >
            اعلان به {selected.size} نفر
          </button>
        )}
        <button
          type="button"
          className="rounded-lg border border-orange-400 px-4 py-2 text-sm text-orange-800"
          onClick={() => openNotify([], 'filter')}
        >
          اعلان به همهٔ فیلتر ({meta.total})
        </button>
      </Card>

      {items.length === 0 ? (
        <PanelEmpty title="مشتری‌ای یافت نشد" />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-light/60 text-right">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={(selected.size === items.length && items.length > 0) || selectAllMatching}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="p-3 font-semibold">نام</th>
                <th className="p-3 font-semibold">موبایل</th>
                <th className="p-3 font-semibold">شهر</th>
                <th className="p-3 font-semibold">عضویت</th>
                <th className="p-3 font-semibold">رزرو</th>
                <th className="p-3 font-semibold">وضعیت</th>
                <th className="p-3 font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t hover:bg-gray-light/30">
                  <td className="p-3">
                    <input type="checkbox" checked={selectAllMatching || selected.has(u.id)} onChange={() => toggleSelect(u.id)} />
                  </td>
                  <td className="p-3 font-medium">{u.profile?.displayName || u.profile?.firstName || 'بدون نام'}</td>
                  <td className="p-3" dir="ltr">{u.phone || '—'}</td>
                  <td className="p-3">{(u as AdminUser & { city?: string }).city || '—'}</td>
                  <td className="p-3">{formatDate(u.createdAt, { style: 'short' })}</td>
                  <td className="p-3">{u.bookingCount ?? '—'}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        u.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : u.status === 'blocked' || u.status === 'suspended'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {STATUS_LABEL[u.status || ''] || u.status || '—'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="rounded border px-2 py-1 text-xs hover:bg-gray-light" onClick={() => openDetail(u.id)}>
                        جزئیات
                      </button>
                      <button type="button" className="rounded border px-2 py-1 text-xs hover:bg-gray-light" onClick={() => openNotify([u.id], 'selected')}>
                        اعلان
                      </button>
                      {u.status === 'active' ? (
                        <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50" disabled={busy} onClick={() => changeStatus(u.id, 'blocked')}>
                          مسدود
                        </button>
                      ) : (
                        <button type="button" className="rounded border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-50" disabled={busy} onClick={() => changeStatus(u.id, 'active')}>
                          فعال‌سازی
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

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => !detailLoading && setDetail(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            {detailLoading ? (
              <PanelLoading />
            ) : detail ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{detail.profile?.displayName || detail.phone || 'مشتری'}</h2>
                    <p className="text-sm text-gray" dir="ltr">{detail.phone}</p>
                  </div>
                  <button type="button" className="text-sm underline" onClick={() => setDetail(null)}>
                    بستن
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Card className="p-3">
                    <p className="text-xs text-gray">وضعیت</p>
                    <p className="font-semibold">{STATUS_LABEL[detail.status || ''] || detail.status}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-gray">عضویت</p>
                    <p className="font-semibold">{formatDate(detail.createdAt, { style: 'short' })}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-gray">رزرو موفق</p>
                    <p className="font-semibold">{detail.stats?.successfulBookings ?? 0}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-xs text-gray">کل رزرو</p>
                    <p className="font-semibold">{detail.stats?.totalBookings ?? 0}</p>
                  </Card>
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">آخرین رزروها</h3>
                  {!detail.bookings?.length ? (
                    <p className="text-sm text-gray">رزروی ثبت نشده</p>
                  ) : (
                    <ul className="space-y-2">
                      {(detail.bookings as AdminUserBooking[]).slice(0, 10).map((b) => (
                        <li key={b.id} className="rounded border p-2 text-sm">
                          <div className="font-medium">{b.professional?.title || '—'}</div>
                          <div className="mt-1 text-xs text-gray">
                            {formatDate(b.startAt, { style: 'short' })} · {formatMoney(b.payment?.amount ?? b.totalPrice)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {notifyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setNotifyOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="mb-4 text-lg font-bold">
              {notifyMode === 'filter' || selectAllMatching
                ? `ارسال اعلان به همهٔ فیلتر (${meta.total} نفر)`
                : `ارسال اعلان به ${notifyTargetIds.length} مشتری`}
            </h3>
            <div className="space-y-3">
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
                    void sendNotify();
                  }}
                >
                  {busy ? 'در حال ارسال...' : 'تأیید و ارسال اعلان'}
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setNotifyOpen(false)}
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
