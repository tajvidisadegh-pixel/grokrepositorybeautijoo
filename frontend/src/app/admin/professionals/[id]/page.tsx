'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import {
  fetchAdminProfessionalDetail,
  adminSetProfessionalStatus,
  adminSetProfessionalFeatured,
  adminSetMediaStatus,
  adminUpdateProfessional,
  type AdminProfessionalDetail,
  resolveMediaUrl,
} from '@/lib/panel-api';
import { persianProfessionalStatus } from '@/lib/persian-status';
import { friendlyApiError } from '@/lib/api-errors';
import { formatDate } from '@/lib/utils';

function money(n?: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('fa-IR').format(Math.round(n)) + ' تومان';
}

export default function AdminProfessionalDetailPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const [data, setData] = useState<AdminProfessionalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const d = await fetchAdminProfessionalDetail(id);
      setData(d);
      setEditTitle(d.title || '');
      setEditBio(d.bio || '');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(status: string, reason?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await adminSetProfessionalStatus(id, status, reason);
      setMsg('وضعیت به‌روز شد');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleFeatured() {
    if (!data) return;
    setBusy(true);
    try {
      await adminSetProfessionalFeatured(id, !data.isFeatured);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function mediaStatus(mediaId: string, status: string) {
    setBusy(true);
    try {
      await adminSetMediaStatus(mediaId, status);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setBusy(true);
    setMsg(null);
    try {
      await adminUpdateProfessional(id, { title: editTitle.trim(), bio: editBio });
      setMsg('پروفایل زیباگر به‌روز شد');
      setEditing(false);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error && !data) return <PanelError message={error} onRetry={load} />;
  if (!data) return <PanelError message="یافت نشد" onRetry={load} />;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/admin/professionals" className="text-sm text-coral">← بازگشت به لیست</Link>
          <h1 className="text-2xl font-bold">{data.user?.profile?.displayName || data.title || data.slug}</h1>
          <p className="text-sm text-gray">{persianProfessionalStatus(data.status)} · {data.user?.phone}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.status !== 'approved' && (
            <Button disabled={busy} onClick={() => setStatus('approved')}>تأیید زیباگر</Button>
          )}
          {data.status !== 'rejected' && (
            <Button variant="outline" disabled={busy} onClick={() => setStatus('rejected', window.prompt('دلیل رد؟') || undefined)}>رد با دلیل</Button>
          )}
          {data.status !== 'suspended' && (
            <Button variant="outline" disabled={busy} onClick={() => setStatus('suspended', window.prompt('دلیل تعلیق؟') || 'تخلف از قوانین')}>تعلیق</Button>
          )}
          {data.status === 'suspended' && (
            <Button disabled={busy} onClick={() => setStatus('approved')}>رفع تعلیق / فعال</Button>
          )}
          <Button variant="outline" disabled={busy} onClick={toggleFeatured}>
            {data.isFeatured ? 'حذف از ویژه' : 'ویژه کردن'}
          </Button>
        </div>
      </div>

      {msg && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">پروفایل</h2>
            <button type="button" className="text-xs underline" onClick={() => setEditing((v) => !v)}>
              {editing ? 'انصراف' : 'ویرایش'}
            </button>
          </div>
          {editing ? (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-xs text-gray">عنوان</label>
                <input className="w-full rounded-lg border px-3 py-2 text-sm" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray">بیو</label>
                <textarea className="w-full rounded-lg border px-3 py-2 text-sm" rows={3} value={editBio} onChange={(e) => setEditBio(e.target.value)} />
              </div>
              <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white" disabled={busy} onClick={saveProfile}>ذخیره</button>
            </div>
          ) : (
            <>
              <p>عنوان: {data.title || '—'}</p>
              <p>بیو: {data.bio || '—'}</p>
            </>
          )}
          <p>شهر: {data.city || data.locations?.[0]?.location?.city || '—'}</p>
          <p>ثبت‌نام: {data.createdAt ? formatDate(data.createdAt) : '—'}</p>
        </Card>
        <Card className="space-y-2 p-4">
          <h2 className="font-semibold">عملکرد</h2>
          <p>کل رزرو: {data.stats?.total ?? 0}</p>
          <p>موفق: {data.stats?.successful ?? 0}</p>
          <p>لغو/رد: {data.stats?.cancelled ?? 0}</p>
          <p>درآمد: {money(data.stats?.revenue)}</p>
          <p>امتیاز: {data.stats?.ratingAvg != null ? Number(data.stats.ratingAvg).toFixed(1) : '—'} ({data.stats?.ratingCount ?? 0})</p>
          <p>نظرات: {data.stats?.reviewCount ?? 0}</p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold">خدمات و قیمت‌ها</h2>
        {(data.professionalServices || []).length === 0 ? (
          <p className="text-sm text-gray">خدمتی ثبت نشده</p>
        ) : (
          <ul className="space-y-2">
            {data.professionalServices!.map((s) => (
              <li key={s.id} className="flex justify-between text-sm">
                <span>{s.service?.name || s.serviceId} · {s.durationMin} دقیقه</span>
                <span>{money(s.price)} {s.isActive === false ? '(غیرفعال)' : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold">رسانه‌ها / نمونه‌کارها</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data.mediaAssets || []).map((m) => (
            <div key={m.id} className="rounded-xl border p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveMediaUrl(m.publicUrl || m.url) || ''} alt="" className="mb-2 h-32 w-full rounded-lg object-cover" />
              <p className="text-xs">{m.kind} · {m.status}</p>
              <div className="mt-1 flex gap-1">
                {m.status !== 'approved' && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => mediaStatus(m.id, 'approved')}>تأیید</Button>
                )}
                {m.status !== 'rejected' && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => mediaStatus(m.id, 'rejected')}>رد</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold">رزروهای اخیر</h2>
        <ul className="space-y-1 text-sm">
          {(data.bookings || []).slice(0, 20).map((b) => (
            <li key={b.id} className="flex justify-between border-b py-1">
              <span>{b.customer?.profile?.displayName || b.customer?.phone || b.id} · {b.status}</span>
              <span>{b.startAt ? formatDate(b.startAt) : ''} · {money(b.totalPrice)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold">نظرات</h2>
        <ul className="space-y-2 text-sm">
          {(data.reviews || []).map((r) => (
            <li key={r.id} className="border-b pb-2">
              <span className="font-medium">{r.rating}★</span> {r.customer?.profile?.displayName || ''}
              <p className="text-gray">{r.comment || '—'}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
