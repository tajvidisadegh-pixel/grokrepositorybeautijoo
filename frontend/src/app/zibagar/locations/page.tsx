'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError, PanelEmpty } from '@/components/panel/state-blocks';
import {
  fetchMyLocations,
  addMyLocation,
  removeMyLocation,
  type LocationItem,
} from '@/lib/panel-api';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';

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
  isPrimary: boolean;
};

const emptyForm = (): FormState => ({
  name: '',
  address: '',
  city: '',
  province: '',
  latitude: null,
  longitude: null,
  isPrimary: false,
});

export default function ZibagarLocationsPage() {
  const [items, setItems] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchMyLocations();
      setItems(
        list.map((loc) => {
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
              isPrimary: anyLoc.isPrimary,
            };
          }
          return loc;
        }),
      );
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

  function startEdit(loc: LocationItem) {
    setEditingId(loc.id);
    setForm({
      name: loc.name || '',
      address: loc.address || '',
      city: loc.city || '',
      province: loc.province || '',
      latitude: loc.latitude != null ? Number(loc.latitude) : null,
      longitude: loc.longitude != null ? Number(loc.longitude) : null,
      isPrimary: !!loc.isPrimary,
    });
    setMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function onSubmit() {
    if (!form.city.trim() || form.city.trim().length < 2) {
      setMsg('شهر حداقل ۲ کاراکتر باشد.');
      return;
    }
    if (!form.address.trim()) {
      setMsg('آدرس را وارد کنید یا روی نقشه نقطه بگذارید.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setMsg(null);
    const payload = {
      name: form.name.trim() || undefined,
      address: form.address.trim(),
      city: form.city.trim(),
      province: form.province.trim() || undefined,
      latitude: form.latitude ?? undefined,
      longitude: form.longitude ?? undefined,
      isPrimary: form.isPrimary,
      precision:
        form.latitude != null && form.longitude != null
          ? ('exact' as const)
          : ('approximate' as const),
    };
    try {
      if (editingId) {
        await apiClient.patch(`/professionals/me/locations/${editingId}`, payload);
        setMsg('مکان به‌روز شد.');
      } else {
        await addMyLocation(payload);
        setMsg('مکان افزوده شد.');
      }
      setEditingId(null);
      setForm(emptyForm());
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('این مکان حذف شود؟')) return;
    setBusyId(id);
    setError(null);
    try {
      await removeMyLocation(id);
      setMsg('حذف شد.');
      if (editingId === id) cancelEdit();
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function setPrimary(id: string) {
    const loc = items.find((x) => x.id === id);
    if (!loc) return;
    setBusyId(id);
    setError(null);
    try {
      await apiClient.patch(`/professionals/me/locations/${id}`, {
        name: loc.name,
        address: loc.address,
        city: loc.city,
        province: loc.province || undefined,
        latitude: loc.latitude ?? undefined,
        longitude: loc.longitude ?? undefined,
        isPrimary: true,
      });
      setMsg('مکان اصلی تنظیم شد.');
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مکان‌ها</h1>
        <p className="mt-1 text-sm text-gray">
          آدرس و موقعیت روی نقشه — برای رزرو و نمایش در پروفایل
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      <Card className="space-y-3">
        <h2 className="font-semibold">{editingId ? 'ویرایش مکان' : 'افزودن مکان'}</h2>
        <Input
          placeholder="نام (مثلاً شعبه اصلی)"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
        />
        <Input
          placeholder="آدرس کامل"
          value={form.address}
          onChange={(e) => setField('address', e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="شهر *"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
          />
          <Input
            placeholder="استان (اختیاری)"
            value={form.province}
            onChange={(e) => setField('province', e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-gray">
            موقعیت روی نقشه — روی نقشه کلیک کنید تا سنجاق جابه‌جا شود
          </p>
          <MapPicker
            latitude={form.latitude}
            longitude={form.longitude}
            onPick={(lat, lng) => {
              setField('latitude', lat);
              setField('longitude', lng);
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray" dir="ltr">
            {form.latitude != null && form.longitude != null ? (
              <>
                <span>
                  {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setField('latitude', null);
                    setField('longitude', null);
                  }}
                >
                  پاک کردن مختصات
                </Button>
              </>
            ) : (
              <span>هنوز نقطه‌ای انتخاب نشده (اختیاری)</span>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray">
          <input
            type="checkbox"
            checked={form.isPrimary}
            onChange={(e) => setField('isPrimary', e.target.checked)}
          />
          مکان اصلی
        </label>

        <div className="flex flex-wrap gap-2">
          <Button loading={submitting} onClick={onSubmit}>
            {editingId ? 'ذخیره تغییرات' : 'افزودن'}
          </Button>
          {editingId && (
            <Button size="sm" variant="outline" onClick={cancelEdit}>
              انصراف
            </Button>
          )}
        </div>
      </Card>

      {items.length === 0 ? (
        <PanelEmpty title="مکانی ثبت نشده" description="حداقل یک آدرس برای رزرو لازم است." />
      ) : (
        <ul className="space-y-3">
          {items.map((loc) => (
            <li key={loc.id}>
              <Card className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {loc.name}
                      {loc.isPrimary ? (
                        <span className="mr-2 text-xs font-medium text-coral"> (اصلی)</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-gray">
                      {loc.city}
                      {loc.province ? ` · ${loc.province}` : ''}
                    </p>
                    <p className="text-sm text-gray">{loc.address}</p>
                    {loc.latitude != null && loc.longitude != null && (
                      <p className="mt-1 text-xs text-gray" dir="ltr">
                        📍 {Number(loc.latitude).toFixed(5)}, {Number(loc.longitude).toFixed(5)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(loc)}>
                    ویرایش
                  </Button>
                  {!loc.isPrimary && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyId === loc.id}
                      onClick={() => setPrimary(loc.id)}
                    >
                      اصلی کردن
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busyId === loc.id}
                    onClick={() => onDelete(loc.id)}
                  >
                    حذف
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
