'use client';

import { useAuth } from '@/contexts/auth-context';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchAdminUsers,
  fetchAdminUserDetail,
  adminSetUserStatus,
  adminNotifyUsers,
  adminCreateCustomer,
  adminUpdateUserProfile,
  type AdminUser,
  type AdminUserDetail,
  type AdminUsersQuery,
} from '@/lib/panel-api';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { formatDate } from '@/lib/utils';

type StatusFilter = '' | 'active' | 'suspended' | 'inactive';

const STATUS_LABEL: Record<string, string> = {
  active: 'فعال',
  blocked: 'مسدود',
  inactive: 'غیرفعال',
  suspended: 'تعلیق',
  deleted: 'حذف‌شده',
};

type CustomersStats = {
  total: number;
  active: number;
  suspended: number;
  inactive: number;
  withBookings: number;
  neverBooked: number;
};

async function hardDelete(id: string) {
  return apiClient.delete(`/admin/users/${id}`);
}
async function bulkHardDelete(userIds: string[]) {
  return apiClient.post<{ deleted: number; failed: string[] }>('/admin/users/bulk-delete', { userIds });
}
async function fetchStats() {
  return apiClient.get<CustomersStats>('/admin/customers/stats');
}

export default function AdminUsersPage() {
  const { startImpersonation, hasRole } = useAuth();

  const [items, setItems] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<CustomersStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [bookingPresence, setBookingPresence] = useState<'' | 'none' | 'has'>('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');
  const [neverNotified, setNeverNotified] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyBody, setNotifyBody] = useState('');
  const [notifySms, setNotifySms] = useState(false);
  const [notifyTargetIds, setNotifyTargetIds] = useState<string[]>([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPhone, setCreatePhone] = useState('');
  const [createName, setCreateName] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const currentFilters = useMemo((): Omit<AdminUsersQuery, 'page' | 'limit'> => ({
    search: search.trim() || undefined,
    status: status || undefined,
    accountType: 'customer',
    bookingPresence: bookingPresence || undefined,
    bookingStatus: bookingStatus || undefined,
    registeredFrom: registeredFrom || undefined,
    registeredTo: registeredTo || undefined,
    neverNotified: neverNotified || undefined,
    hasPaid: hasPaid || undefined,
  }), [search, status, bookingPresence, bookingStatus, registeredFrom, registeredTo, neverNotified, hasPaid]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, st] = await Promise.all([
        fetchAdminUsers({ page, limit: 20, ...currentFilters }),
        fetchStats().catch(() => null),
      ]);
      setItems(res.items);
      setMeta(res.meta || { page, limit: 20, total: res.items.length, totalPages: 1 });
      if (st) setStats(st);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [page, currentFilters]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((u) => u.id)));
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await fetchAdminUserDetail(id);
      setDetail(d);
      setEditName(d.profile?.displayName || '');
      setEditPhone(d.phone || '');
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
      await adminSetUserStatus(id, newStatus === 'blocked' ? 'suspended' : newStatus);
      setActionMsg('وضعیت به‌روز شد');
      await load();
      if (detail?.id === id) await openDetail(id);
    } catch (e) {
      setActionMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const removeOne = async (id: string) => {
    if (!window.confirm('حذف کامل این مشتری؟ این عمل برگشت‌ناپذیر است و رزروهای مرتبط هم حذف می‌شوند.')) return;
    setBusy(true);
    setActionMsg(null);
    try {
      await hardDelete(id);
      setActionMsg('مشتری به‌طور کامل حذف شد');
      setDetail(null);
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      await load();
    } catch (e) {
      setActionMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const removeSelected = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!window.confirm(`حذف کامل ${ids.length} مشتری؟ این عمل برگشت‌ناپذیر است.`)) return;
    setBusy(true);
    setActionMsg(null);
    try {
      const res = await bulkHardDelete(ids);
      setActionMsg(`${res.deleted} مشتری حذف شد${res.failed?.length ? ` · ناموفق: ${res.failed.length}` : ''}`);
      setSelected(new Set());
      setDetail(null);
      await load();
    } catch (e) {
      setActionMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const openNotify = (ids: string[]) => {
    setNotifyTargetIds(ids);
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
      const res = await adminNotifyUsers({
        userIds: notifyTargetIds,
        title: notifyTitle.trim(),
        body: notifyBody.trim(),
        sms: notifySms,
      });
      setActionMsg(`اعلان برای ${res.notified} مشتری ارسال شد`);
      setNotifyOpen(false);
      setSelected(new Set());
    } catch (e) {
      setActionMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitCreate = async () => {
    if (!createPhone.trim() || createPhone.trim().length < 10) {
      setActionMsg('شماره موبایل معتبر وارد کنید');
      return;
    }
    setBusy(true);
    setActionMsg(null);
    try {
      await adminCreateCustomer({ phone: createPhone.trim(), displayName: createName.trim() || undefined });
      setActionMsg('مشتری افزوده شد');
      setCreateOpen(false);
      await load();
    } catch (e) {
      setActionMsg(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!detail) return;
    setBusy(true);
    setActionMsg(null);
    try {
      const d = await adminUpdateUserProfile(detail.id, {
        displayName: editName.trim() || undefined,
        phone: editPhone.trim() || undefined,
      });
      setDetail(d);
      setActionMsg('پروفایل به‌روز شد');
      await load();
    } catch (e) {
      setActionMsg(friendlyApiError(e));
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
          <h1 className="text-2xl font-bold">مشتریان</h1>
          <p className="mt-1 text-sm text-gray">افزودن، ویرایش، حذف کامل (تکی و چندتایی)، فیلتر و اعلان</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white"
          onClick={() => { setCreatePhone(''); setCreateName(''); setCreateOpen(true); }}
        >
          افزودن مشتری
        </button>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card className="border-gray-200 bg-gray-50 p-4">
            <p className="text-xs text-gray-600">کل مشتریان</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="border-green-200 bg-green-50 p-4">
            <p className="text-xs text-green-700">فعال</p>
            <p className="text-2xl font-bold text-green-800">{stats.active}</p>
          </Card>
          <Card className="border-red-200 bg-red-50 p-4">
            <p className="text-xs text-red-700">تعلیق / مسدود</p>
            <p className="text-2xl font-bold text-red-800">{stats.suspended}</p>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50 p-4">
            <p className="text-xs text-yellow-700">غیرفعال</p>
            <p className="text-2xl font-bold text-yellow-800">{stats.inactive}</p>
          </Card>
          <Card className="border-blue-200 bg-blue-50 p-4">
            <p className="text-xs text-blue-700">دارای رزرو</p>
            <p className="text-2xl font-bold text-blue-800">{stats.withBookings}</p>
          </Card>
          <Card className="border-orange-200 bg-orange-50 p-4">
            <p className="text-xs text-orange-700">بدون رزرو</p>
            <p className="text-2xl font-bold text-orange-800">{stats.neverBooked}</p>
          </Card>
        </div>
      )}

      {actionMsg && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm">
          {actionMsg}
          <button type="button" className="mr-3 text-xs underline" onClick={() => setActionMsg(null)}>بستن</button>
        </div>
      )}

      <Card className="space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="جستجو نام / موبایل" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())} />
          <select className="rounded-xl border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="">همه وضعیت‌ها</option>
            <option value="active">فعال</option>
            <option value="suspended">تعلیق / مسدود</option>
            <option value="inactive">غیرفعال</option>
          </select>
          <select className="rounded-xl border px-3 py-2 text-sm" value={bookingPresence} onChange={(e) => setBookingPresence(e.target.value as '' | 'none' | 'has')}>
            <option value="">رزرو: همه</option>
            <option value="has">دارای رزرو</option>
            <option value="none">بدون رزرو</option>
          </select>
          <select className="rounded-xl border px-3 py-2 text-sm" value={bookingStatus} onChange={(e) => setBookingStatus(e.target.value)}>
            <option value="">وضعیت رزرو: همه</option>
            <option value="completed">تکمیل‌شده</option>
            <option value="confirmed">تأییدشده</option>
            <option value="cancelled">لغو</option>
            <option value="pending">در انتظار</option>
          </select>
          <input className="rounded-xl border px-3 py-2 text-sm" type="date" value={registeredFrom} onChange={(e) => setRegisteredFrom(e.target.value)} title="عضویت از" />
          <input className="rounded-xl border px-3 py-2 text-sm" type="date" value={registeredTo} onChange={(e) => setRegisteredTo(e.target.value)} title="عضویت تا" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={neverNotified} onChange={(e) => setNeverNotified(e.target.checked)} />هرگز اعلان نگرفته</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasPaid} onChange={(e) => setHasPaid(e.target.checked)} />پرداخت داشته</label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white" onClick={() => { setPage(1); load(); }} disabled={loading}>اعمال فیلتر</button>
          {selected.size > 0 && (
            <>
              <button type="button" className="rounded-lg border border-emerald-600 px-4 py-2 text-sm text-emerald-700" onClick={() => openNotify(Array.from(selected))}>اعلان به {selected.size} نفر</button>
              <button type="button" className="rounded-lg border border-red-400 px-4 py-2 text-sm text-red-700" disabled={busy} onClick={removeSelected}>حذف کامل {selected.size} نفر</button>
            </>
          )}
        </div>
      </Card>

      {items.length === 0 ? (
        <PanelEmpty title="مشتری‌ای یافت نشد" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-right text-xs text-gray-600">
                <th className="px-3 py-2 font-medium">
                  <input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={toggleSelectAll} />
                </th>
                <th className="px-3 py-2 font-medium">نام</th>
                <th className="px-3 py-2 font-medium">موبایل</th>
                <th className="px-3 py-2 font-medium">وضعیت</th>
                <th className="px-3 py-2 font-medium">رزرو</th>
                <th className="px-3 py-2 font-medium">عضویت</th>
                <th className="px-3 py-2 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50/80">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSelect(u.id)} />
                  </td>
                  <td className="px-3 py-2 font-medium">{u.profile?.displayName || u.profile?.firstName || 'بدون نام'}</td>
                  <td className="px-3 py-2" dir="ltr">{u.phone || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      u.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {STATUS_LABEL[u.status || ''] || u.status || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2">{u.bookingCount != null ? u.bookingCount : '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(u.createdAt, { style: 'short' })}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={() => openDetail(u.id)}>جزئیات</button>
                      <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={() => openNotify([u.id])}>اعلان</button>
                      {u.status === 'active' ? (
                        <button type="button" className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700" disabled={busy} onClick={() => changeStatus(u.id, 'suspended')}>مسدود</button>
                      ) : (
                        <button type="button" className="rounded border border-green-300 px-2 py-0.5 text-xs text-green-700" disabled={busy} onClick={() => changeStatus(u.id, 'active')}>فعال</button>
                      )}
                      <button type="button" className="rounded border border-red-500 px-2 py-0.5 text-xs text-red-700" disabled={busy} onClick={() => removeOne(u.id)}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={toggleSelectAll} />انتخاب همهٔ صفحه</label>
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button type="button" className="rounded border px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>قبلی</button>
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
                    <h2 className="text-xl font-bold">{detail.profile?.displayName || detail.phone || 'مشتری'}</h2>
                    <p className="text-sm text-gray" dir="ltr">{detail.phone}</p>
                  </div>
                  <button type="button" className="text-sm underline" onClick={() => setDetail(null)}>بستن</button>
                </div>
                <Card className="space-y-3 p-4">
                  <h3 className="font-semibold text-sm">ویرایش پروفایل</h3>
                  <div>
                    <label className="mb-1 block text-xs text-gray">نام</label>
                    <input className="w-full rounded-lg border px-3 py-2 text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray">موبایل</label>
                    <input className="w-full rounded-lg border px-3 py-2 text-sm" dir="ltr" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white" disabled={busy} onClick={saveProfile}>ذخیره</button>
                    <button type="button" className="rounded-lg border border-red-500 px-3 py-1.5 text-xs text-red-700" disabled={busy} onClick={() => removeOne(detail.id)}>حذف کامل</button>
                    {hasRole('SUPER_ADMIN') && (
                      <button type="button" className="rounded-lg border border-coral px-3 py-1.5 text-xs text-coral" disabled={busy}
                        onClick={async () => {
                          if (!confirm('آیا می‌خواهید به عنوان این مشتری وارد شوید؟')) return;
                          setBusy(true);
                          try {
                            await startImpersonation(detail.id);
                            window.location.href = '/panel';
                          } catch (e: unknown) {
                            setActionMsg(e instanceof Error ? e.message : 'خطا در ورود به حساب مشتری');
                          } finally { setBusy(false); }
                        }}>ورود به حساب مشتری</button>
                    )}
                  </div>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {notifyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setNotifyOpen(false)}>
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h2 className="text-lg font-bold">ارسال اعلان</h2>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="عنوان" value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} />
            <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={4} placeholder="متن" value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifySms} onChange={(e) => setNotifySms(e.target.checked)} />ارسال SMS</label>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setNotifyOpen(false)}>انصراف</button>
              <button type="button" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white" disabled={busy} onClick={sendNotify}>ارسال</button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h2 className="text-lg font-bold">افزودن مشتری</h2>
            <div>
              <label className="mb-1 block text-xs text-gray">موبایل *</label>
              <input className="w-full rounded-lg border px-3 py-2 text-sm" dir="ltr" value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} placeholder="09xxxxxxxxx" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray">نام نمایشی</label>
              <input className="w-full rounded-lg border px-3 py-2 text-sm" value={createName} onChange={(e) => setCreateName(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setCreateOpen(false)}>انصراف</button>
              <button type="button" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white" disabled={busy} onClick={submitCreate}>ثبت</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
