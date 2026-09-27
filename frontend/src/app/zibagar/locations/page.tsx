'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchMyLocations,
  addMyLocation,
  removeMyLocation,
  deleteMyMedia,
  resolveMediaUrl,
  isAllowedImageFile,
  type LocationItem,
} from '@/lib/panel-api';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';
import { uploadMyMedia } from '@/lib/media-upload';

const MapPicker = dynamic(() => import('@/components/map/location-picker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[220px] items-center justify-center rounded-xl border border-border bg-gray-light/40 text-sm text-gray">
      در حال بارگذاری نقشه…
    </div>
  ),
});

type FormState = {
  name: string;
  address: string;
  city: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
  precision: 'exact' | 'approximate';
};

const emptyForm = (): FormState => ({
  name: '',
  address: '',
  city: '',
  province: '',
  latitude: null,
  longitude: null,
  precision: 'approximate',
});

export default function ZibagarLocationsPage() {
  const [item, setItem] = useState<LocationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [salonMedia, setSalonMedia] = useState<Array<{ id: string; publicUrl?: string | null; url?: string | null; mimeType?: string | null }>>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchMyLocations();
      const normalized = list.map((loc) => {
        const anyLoc = loc as LocationItem & { location?: LocationItem };
        if (anyLoc.location) {
          return {
            id: anyLoc.location.id,
            name: anyLoc.location.name,
            address: anyLoc.location.address,
            city: anyLoc.location.city,
            province: anyLoc.location.province,
            latitude: anyLoc.location.latitude,
            longitude: anyLoc.location.longitude,
            precision: (anyLoc.location as LocationItem).precision,
            isPrimary: anyLoc.isPrimary,
          } as LocationItem;
        }
        return loc;
      });
      const first = normalized[0] || null;
      setItem(first);
      if (first) {
        const prec =
          first.precision === 'exact' || first.precision === 'approximate'
            ? first.precision
            : first.latitude != null && first.longitude != null
              ? 'exact'
              : 'approximate';
        setForm({
          name: first.name || '',
          address: first.address || '',
          city: first.city || '',
          province: first.province || '',
          latitude: first.latitude != null ? Number(first.latitude) : null,
          longitude: first.longitude != null ? Number(first.longitude) : null,
          precision: prec,
        });
      } else {
        setForm(emptyForm());
      }
      try {
        const res = await apiClient.get<Array<{ id: string; publicUrl?: string; url?: string; mimeType?: string }> | { items?: Array<{ id: string; publicUrl?: string; url?: string; mimeType?: string }> }>('/professionals/me/media?kind=salon');
        const list = Array.isArray(res) ? res : res.items || [];
        setSalonMedia(list.map((m) => ({ ...m, publicUrl: resolveMediaUrl(m.publicUrl || m.url) || m.publicUrl || m.url })));
      } catch { setSalonMedia([]); }
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit() {
    if (!form.city.trim() || form.city.trim().length < 2) {
      setMsg('شهر حداقل ۲ کاراکتر باشد.');
      return;
    }
    if (form.precision === 'exact' && !form.address.trim()) {
      setMsg('برای آدرس دقیق، متن آدرس یا نقطه روی نقشه لازم است.');
      return;
    }
    if (form.precision === 'exact' && (form.latitude == null || form.longitude == null)) {
      setMsg('برای نمایش دقیق، نقطه را روی نقشه مشخص کنید.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setMsg(null);
    const payload = {
      name: form.name.trim() || undefined,
      address:
        form.precision === 'approximate'
          ? form.address.trim() || undefined
          : form.address.trim(),
      city: form.city.trim(),
      province: form.province.trim() || undefined,
      latitude: form.latitude ?? undefined,
      longitude: form.longitude ?? undefined,
      isPrimary: true,
      precision: form.precision,
    };
    try {
      if (item?.id) {
        await apiClient.patch(`/professionals/me/locations/${item.id}`, payload);
        setMsg('مکان کار به‌روز شد.');
      } else {
        await addMyLocation(payload);
        setMsg('مکان کار ثبت شد.');
      }
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!item?.id) return;
    if (!confirm('مکان کار حذف شود؟ رزروهای قبلی حفظ می‌مانند.')) return;
    setDeleting(true);
    setError(null);
    try {
      await removeMyLocation(item.id);
      setMsg('مکان حذف شد.');
      setItem(null);
      setForm(emptyForm());
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setDeleting(false);
    }
  }


  async function onSalonUpload(file: File) {
    const isVideo = (file.type || '').startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    if (!isVideo && !isAllowedImageFile(file)) { setMsg('فقط تصویر یا ویدیو مجاز است.'); return; }
    if (!isVideo && isAllowedImageFile(file) && file.size > 10 * 1024 * 1024) { setMsg('حجم تصویر حداکثر ۱۰ مگابایت است.'); return; }
    if (isVideo && file.size > 500 * 1024 * 1024) { setMsg('حجم ویدیو حداکثر ۵۰۰ مگابایت است.'); return; }
    setMediaBusy(true); setMsg(null); setError(null);
    try { await uploadMyMedia(file, 'salon'); setMsg('رسانه سالن اضافه شد.'); await load(); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setMediaBusy(false); if (mediaInputRef.current) mediaInputRef.current.value = ''; }
  }
  async function onSalonDelete(id: string) {
    if (!confirm('این رسانه سالن حذف شود؟')) return;
    setMediaBusy(true);
    try { await deleteMyMedia(id); setSalonMedia((prev) => prev.filter((m) => m.id !== id)); setMsg('رسانه حذف شد.'); }
    catch (e) { setError(friendlyApiError(e)); }
    finally { setMediaBusy(false); }
  }

  if (loading) return <PanelLoading />;
  if (error && !item && !form.city) return <PanelError message={error} onRetry={load} />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-16">
      <div>
        <h1 className="text-2xl font-bold">مکان کار</h1>
        <p className="mt-1 text-sm text-gray">
          هر زیباگر فقط یک مکان پایه دارد. نقشه و مسیریابی مشتری با «نشان» انجام می‌شود.
          می‌توانید آدرس دقیق یا محدوده تقریبی را برای حفظ حریم خصوصی انتخاب کنید.
        </p>
      </div>

      {msg && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-coral/30 bg-coral/5 px-3 py-2 text-sm text-coral">
          {error}
        </p>
      )}

      <Card className="space-y-4 p-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">نوع نمایش مکان</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm ${
                form.precision === 'approximate'
                  ? 'bg-coral text-white'
                  : 'border border-border bg-white text-foreground'
              }`}
              onClick={() => setField('precision', 'approximate')}
            >
              محدوده تقریبی
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm ${
                form.precision === 'exact'
                  ? 'bg-coral text-white'
                  : 'border border-border bg-white text-foreground'
              }`}
              onClick={() => setField('precision', 'exact')}
            >
              آدرس دقیق
            </button>
          </div>
          <p className="text-xs text-gray">
            {form.precision === 'approximate'
              ? 'فقط شهر/محله به مشتری نشان داده می‌شود؛ پین نقشه عمومی نمی‌شود.'
              : 'آدرس و پین روی نقشه برای مشتری قابل مشاهده است و می‌تواند با نشان مسیریابی کند.'}
          </p>
        </div>

        <label className="block space-y-1 text-sm">
          نام مکان (اختیاری)
          <Input
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="مثلاً سالن زیبایی…"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            شهر *
            <Input
              value={form.city}
              onChange={(e) => setField('city', e.target.value)}
              placeholder="تهران"
            />
          </label>
          <label className="block space-y-1 text-sm">
            استان
            <Input
              value={form.province}
              onChange={(e) => setField('province', e.target.value)}
              placeholder="تهران"
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          {form.precision === 'approximate' ? 'توضیح محدوده (اختیاری)' : 'آدرس دقیق *'}
          <Input
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            placeholder={
              form.precision === 'approximate' ? 'مثلاً سعادت‌آباد' : 'خیابان، پلاک…'
            }
          />
        </label>

        {form.precision === 'exact' && (
          <div className="space-y-2">
            <p className="text-sm font-medium">نقطه روی نقشه</p>
            <MapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onPick={(lat, lng) => {
                setField('latitude', lat);
                setField('longitude', lng);
              }}
            />
            {form.latitude != null && form.longitude != null && (
              <p className="text-xs text-gray" dir="ltr">
                {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button loading={submitting} onClick={onSubmit}>
            {item ? 'ذخیره تغییرات' : 'ثبت مکان کار'}
          </Button>
          {item && (
            <Button variant="outline" loading={deleting} onClick={onDelete}>
              حذف مکان
            </Button>
          )}
        </div>
      </Card>


      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">عکس و فیلم سالن</h2>
            <p className="mt-1 text-sm text-gray">جدا از نمونه‌کار خدمات</p>
          </div>
          <div>
            <input ref={mediaInputRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onSalonUpload(f); }} />
            <Button size="sm" loading={mediaBusy} onClick={() => mediaInputRef.current?.click()}>افزودن عکس / فیلم</Button>
          </div>
        </div>
        {salonMedia.length === 0 ? (
          <p className="text-sm text-gray">هنوز رسانه‌ای برای سالن ثبت نشده است.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {salonMedia.map((m) => {
              const url = m.publicUrl || m.url || '';
              const video = (m.mimeType || '').startsWith('video/');
              return (
                <div key={m.id} className="relative h-28 w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-gray-light/30">
                  {video ? <video src={url} className="h-full w-full object-cover" muted playsInline /> : <img src={url} alt="" className="h-full w-full object-cover" />}
                  <button type="button" disabled={mediaBusy} onClick={() => void onSalonDelete(m.id)} className="absolute left-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">حذف</button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {!item && (
        <PanelEmpty
          title="هنوز مکانی ثبت نشده"
          description="حداقل یک مکان پایه برای انتشار پروفایل و رزرو لازم است."
        />
      )}
    </div>
  );
}
