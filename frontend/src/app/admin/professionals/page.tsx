'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchAdminProfessionals,
  fetchAdminProfessionalsQueue,
  adminSetProfessionalStatus,
  type AdminProfessional,
  type AdminProfessionalsQueue,
} from '@/lib/panel-api';
import { persianProfessionalStatus } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';
import { adminNotifyUsers } from '@/lib/panel-api';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { JalaliDateInput } from '@/components/ui/jalali-date-input';


const STATUSES = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'pending_review', label: 'در انتظار بررسی' },
  { value: 'approved', label: 'فعال' },
  { value: 'rejected', label: 'رد شده' },
  { value: 'suspended', label: 'تعلیق‌شده' },
];

export default function AdminProfessionalsPage() {
  const [items, setItems] = useState<AdminProfessional[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [queue, setQueue] = useState<AdminProfessionalsQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [city, setCity] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [minRating, setMinRating] = useState('');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPhone, setCreatePhone] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createName, setCreateName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status || undefined,
      city: city.trim() || undefined,
      specialty: specialty.trim() || undefined,
      minRating: minRating ? Number(minRating) : undefined,
      registeredFrom: registeredFrom || undefined,
      registeredTo: registeredTo || undefined,
    }),
    [search, status, city, specialty, minRating, registeredFrom, registeredTo],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, q] = await Promise.all([
        fetchAdminProfessionals({ page, limit: 20, ...filters }),
        fetchAdminProfessionalsQueue().catch(() => null),
      ]);
      setItems(list.items);
      setSelected(new Set());
      setMeta(list.meta);
      setQueue(q);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function createProfessional() {
    if (!createPhone.trim() || !createTitle.trim()) {
      setError('موبایل و نام زیباگر الزامی است');
      return;
    }
    setCreateBusy(true); setError(null); setMsg(null);
    try {
      await apiClient.post('/admin/professionals', {
        phone: createPhone.trim(),
        title: createTitle.trim(),
        displayName: createName.trim() || createTitle.trim(),
      });
      setCreateOpen(false);
      setCreatePhone(''); setCreateTitle(''); setCreateName('');
      setMsg('حساب زیباگر ساخته شد و برای بررسی قرار گرفت.');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setCreateBusy(false);
    }
  }

  async function onStatus(id: string, next: string) {
    setBusyId(id);
    setMsg(null);
    try {
      await adminSetProfessionalStatus(id, next);
      setMsg('وضعیت به‌روز شد');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function onNotify(p: AdminProfessional) {
    const title = window.prompt('عنوان اعلان', 'پیام مدیریت');
    if (title == null) return;
    const body = window.prompt('متن اعلان', '');
    if (body == null || !String(body).trim()) return;
    const userId = p.userId || p.user?.id;
    if (!userId) { setError('شناسه کاربر زیباگر یافت نشد'); return; }
    setBusyId(p.id); setError(null); setMsg(null);
    try {
      const res = await adminNotifyUsers({ userIds: [userId], title: title.trim(), body: String(body).trim() });
      setMsg('اعلان ارسال شد (' + String(res.notified ?? 1) + ')');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => prev.size === items.length && items.length > 0 ? new Set() : new Set(items.map((p) => p.id)));
  }

  async function bulkAction(kind: 'approve' | 'delete') {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (kind === 'delete' && !window.confirm(`حذف کامل ${ids.length} زیباگر انتخاب‌شده؟`)) return;
    setBulkBusy(true); setError(null); setMsg(null);
    try {
      for (const id of ids) {
        if (kind === 'approve') await adminSetProfessionalStatus(id, 'approved');
        else await apiClient.delete(`/admin/professionals/${id}`);
      }
      setMsg(kind === 'approve' ? `${ids.length} زیباگر تأیید شد` : `${ids.length} زیباگر حذف شد`);
      setSelected(new Set());
      await load();
    } catch (e) { setError(friendlyApiError(e)); }
    finally { setBulkBusy(false); }
  }

  async function onDelete(id: string) {
    if (!window.confirm('حذف کامل این زیباگر؟ رزروها و نظرات مرتبط حذف می‌شوند.')) return;
    setBusyId(id); setError(null); setMsg(null);
    try {
      await apiClient.delete(`/admin/professionals/${id}`);
      setMsg('زیباگر حذف شد');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusyId(null);
    }
  }


  if (loading && items.length === 0) return <PanelLoading />;
  if (error && items.length === 0) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">زیباگرها</h1>
        <div className="flex flex-wrap items-center gap-2">
          <p className="mt-1 text-sm text-gray">مدیریت، فیلتر و صف بررسی زیباگرها</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>+ افزودن زیباگر</Button>
        </div>
      </div>

      {queue && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/professionals?status=pending_review">
            <Card className="border-red-200 bg-red-50 p-4 hover:shadow">
              <p className="text-xs text-red-700">در انتظار تأیید</p>
              <p className="text-2xl font-bold text-red-800">{queue.pendingProfessionals ?? 0}</p>
            </Card>
          </Link>
          <Card className="border-orange-200 bg-orange-50 p-4">
            <p className="text-xs text-orange-700">نمونه‌کار منتظر بررسی</p>
            <p className="text-2xl font-bold text-orange-800">{queue.pendingMedia ?? 0}</p>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50 p-4">
            <p className="text-xs text-yellow-700">پروفایل ناقص</p>
            <p className="text-2xl font-bold text-yellow-800">{queue.incompleteProfiles ?? 0}</p>
          </Card>
          <Card className="border-gray-200 bg-gray-50 p-4">
            <p className="text-xs text-gray-600">تعلیق‌شده</p>
            <p className="text-2xl font-bold">{queue.suspendedProfessionals ?? 0}</p>
          </Card>
        </div>
      )}

      <Card className="space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder="جستجو نام / موبایل / عنوان"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="rounded-xl border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="شهر" value={city} onChange={(e) => setCity(e.target.value)} />
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="تخصص" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
          <input className="rounded-xl border px-3 py-2 text-sm" type="number" step="0.1" placeholder="حداقل امتیاز" value={minRating} onChange={(e) => setMinRating(e.target.value)} />
          <JalaliDateInput value={registeredFrom} onChange={setRegisteredFrom} className="min-w-[10rem]" />
          <JalaliDateInput value={registeredTo} onChange={setRegisteredTo} className="min-w-[10rem]" />
          <Button onClick={() => { setPage(1); load(); }}>اعمال فیلتر</Button>
        </div>
      </Card>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</p>}

      {selected.size > 0 && (
        <Card className="flex flex-wrap items-center gap-2 border-coral/30 bg-coral-soft/30 p-3">
          <span className="text-sm font-medium">{selected.size} زیباگر انتخاب شده</span>
          <Button size="sm" loading={bulkBusy} onClick={() => void bulkAction('approve')}>تأیید گروهی</Button>
          <Button size="sm" variant="outline" loading={bulkBusy} onClick={() => void bulkAction('delete')}>حذف گروهی</Button>
          <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>لغو انتخاب</Button>
        </Card>
      )}

      {loading ? <PanelLoading /> : items.length === 0 ? (
        <PanelEmpty title="زیباگری یافت نشد" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-right text-xs text-gray-600">
                <th className="px-3 py-2 font-medium"><input aria-label="انتخاب همه" type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={toggleSelectAll} /></th>
                <th className="px-3 py-2 font-medium">نام / عنوان</th>
                <th className="px-3 py-2 font-medium">موبایل</th>
                <th className="px-3 py-2 font-medium">شهر</th>
                <th className="px-3 py-2 font-medium">امتیاز</th>
                <th className="px-3 py-2 font-medium">وضعیت</th>
                <th className="px-3 py-2 font-medium">عضویت</th>
                <th className="px-3 py-2 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50/80">
                  <td className="px-3 py-2">
                    <Link href={`/admin/professionals/${p.id}`} className="font-medium text-coral hover:underline">
                      {p.user?.profile?.displayName || p.title || p.slug}
                    </Link>
                    <div className="text-xs text-gray" dir="ltr">{p.slug}</div>
                  </td>
                  <td className="px-3 py-2" dir="ltr">{p.user?.phone || '—'}</td>
                  <td className="px-3 py-2">{p.city || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.ratingAvg != null ? Number(p.ratingAvg).toFixed(1) : '—'} ({p.ratingCount ?? 0})
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-coral-soft px-2 py-0.5 text-xs text-coral">{persianProfessionalStatus(p.status)}</span>
                    {p.isFeatured ? <span className="mr-1 text-xs text-amber-600">ویژه</span> : null}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.createdAt ? formatDate(p.createdAt) : '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.status !== 'approved' && (
                        <Button size="sm" loading={busyId === p.id} onClick={() => onStatus(p.id, 'approved')}>تأیید</Button>
                      )}
                      <Link href={`/admin/professionals/${p.id}`}>
                        <Button size="sm" variant="outline">ویرایش</Button>
                      </Link>
                      <Button size="sm" variant="outline" loading={busyId === p.id} onClick={() => onNotify(p)}>اعلان</Button>
                      <Button size="sm" variant="outline" loading={busyId === p.id} onClick={() => onDelete(p.id)}>حذف</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</Button>
          <span className="text-sm">{page} / {meta.totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>بعدی</Button>
        </div>
      )}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !createBusy && setCreateOpen(false)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div>
              <h2 className="text-lg font-bold">افزودن زیباگر توسط سوپرادمین</h2>
              <p className="mt-1 text-xs text-gray">حساب با وضعیت «در انتظار بررسی» ساخته می‌شود؛ بعداً می‌توانی پروفایل و خدماتش را تکمیل کنی.</p>
            </div>
            <label className="block text-xs"><span className="mb-1 block">موبایل *</span><input className="w-full rounded-lg border px-3 py-2" dir="ltr" value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} placeholder="09xxxxxxxxx" /></label>
            <label className="block text-xs"><span className="mb-1 block">نام/عنوان زیباگر *</span><input className="w-full rounded-lg border px-3 py-2" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="مثلاً مریم احمدی" /></label>
            <label className="block text-xs"><span className="mb-1 block">نام نمایشی (اختیاری)</span><input className="w-full rounded-lg border px-3 py-2" value={createName} onChange={(e) => setCreateName(e.target.value)} /></label>
            <div className="flex justify-end gap-2"><Button variant="outline" disabled={createBusy} onClick={() => setCreateOpen(false)}>انصراف</Button><Button loading={createBusy} onClick={() => void createProfessional()}>ساخت حساب</Button></div>
          </div>
        </div>
      )}

    </div>
  );
}