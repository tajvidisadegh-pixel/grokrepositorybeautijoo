'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelLoading, PanelError } from '@/components/panel/state-blocks';
import { apiClient } from '@/lib/api';
import { friendlyApiError } from '@/lib/api-errors';

type S = {
  booking: { slotStepMin: number; holdMinutes: number; cancelWindowHours: number; allowSameDay: boolean };
  commission: { ratePercent: number };
  professionals: { requireManualReview: boolean; minServicesToPublish: number };
  reviews: { autoPublish: boolean; minCommentLength: number };
  search: { nearMeDefaultRadiusKm: number; featuredBoost: boolean };
  auth: { otpTtlSeconds: number; maxOtpAttempts: number; loginRateLimitPerMinute: number };
  privacy: { defaultLocationPrecision: 'exact' | 'approximate'; showPhoneToCustomer: boolean };
  public: { siteName: string; supportPhone: string; maintenanceMode: boolean };
};

type K = keyof S;

const SECTIONS: { key: K; icon: string; title: string; desc: string }[] = [
  { key: 'booking', icon: '📅', title: 'رزرو و زمان‌بندی', desc: 'قوانین و رفتار سیستم رزرو' },
  { key: 'commission', icon: '💰', title: 'کمیسیون', desc: 'قوانین محاسبه سهم Beautijoo' },
  { key: 'professionals', icon: '💅', title: 'زیباگرها', desc: 'قوانین ثبت‌نام و تأیید زیباگر' },
  { key: 'reviews', icon: '⭐', title: 'نظرات و امتیازها', desc: 'قوانین ثبت و نمایش نظرات' },
  { key: 'search', icon: '🔎', title: 'جستجو و «نزدیک من»', desc: 'قوانین نمایش و رتبه‌بندی نتایج' },
  { key: 'auth', icon: '🔐', title: 'احراز هویت', desc: 'OTP، ورود و محدودیت‌های امنیتی' },
  { key: 'privacy', icon: '🛡️', title: 'حریم خصوصی', desc: 'اطلاعاتی که به مشتری نمایش داده می‌شود' },
  { key: 'public', icon: '🌐', title: 'عمومی', desc: 'تنظیمات کلی پلتفرم' },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<S | null>(null);
  const [active, setActive] = useState<K | null>(null);
  const [draft, setDraft] = useState<S | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<S>('/admin/settings');
      setSettings(data);
      setDraft(data);
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(key: K) {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const next = await apiClient.put<S>('/admin/settings', { [key]: draft[key] });
      setSettings(next);
      setDraft(next);
      setMsg('ذخیره شد');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error && !settings) return <PanelError message={error} onRetry={load} />;
  if (!settings || !draft) return null;

  const sec = active ? SECTIONS.find((s) => s.key === active) : null;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">⚙️ تنظیمات</h1>
        <p className="mt-1 text-sm text-gray">قوانین کلی پلتفرم — هر بخش جدا ذخیره می‌شود</p>
      </div>
      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!active && (
        <div className="grid gap-3 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setActive(s.key);
                setMsg(null);
                setError(null);
              }}
              className="rounded-2xl border border-border bg-white p-4 text-right shadow-sm transition hover:border-coral/40"
            >
              <p className="font-bold">
                {s.icon} {s.title}
              </p>
              <p className="mt-1 text-xs text-gray">{s.desc}</p>
            </button>
          ))}
        </div>
      )}

      {active && sec && (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">
              {sec.icon} {sec.title}
            </h2>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setActive(null);
                setDraft(settings);
              }}
            >
              بازگشت
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(draft[active] as Record<string, unknown>).map(([k, v]) => {
              if (typeof v === 'boolean') {
                return (
                  <label
                    key={k}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-coral"
                      checked={v}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [active]: { ...(draft[active] as object), [k]: e.target.checked },
                        })
                      }
                    />
                    <span>{labelFa(k)}</span>
                  </label>
                );
              }
              if (k === 'defaultLocationPrecision') {
                return (
                  <div key={k}>
                    <label className="mb-1.5 block text-sm font-medium">{labelFa(k)}</label>
                    <select
                      className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
                      value={String(v)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [active]: { ...(draft[active] as object), [k]: e.target.value },
                        })
                      }
                    >
                      <option value="approximate">تقریبی</option>
                      <option value="exact">دقیق</option>
                    </select>
                  </div>
                );
              }
              return (
                <div key={k}>
                  <label className="mb-1.5 block text-sm font-medium">{labelFa(k)}</label>
                  <Input
                    type={typeof v === 'number' ? 'number' : 'text'}
                    dir="ltr"
                    className="text-left"
                    value={v as string | number}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [active]: {
                          ...(draft[active] as object),
                          [k]: typeof v === 'number' ? Number(e.target.value) : e.target.value,
                        },
                      })
                    }
                  />
                </div>
              );
            })}
          </div>

          <Button type="button" loading={saving} onClick={() => void save(active)}>
            ذخیره این بخش
          </Button>
        </Card>
      )}
    </div>
  );
}

function labelFa(key: string): string {
  const map: Record<string, string> = {
    slotStepMin: 'گام اسلات (دقیقه)',
    holdMinutes: 'نگه‌داشت رزرو (دقیقه)',
    cancelWindowHours: 'مهلت لغو (ساعت)',
    allowSameDay: 'اجازه رزرو همان روز',
    ratePercent: 'نرخ کمیسیون (%)',
    requireManualReview: 'تأیید دستی قبل از انتشار',
    minServicesToPublish: 'حداقل خدمت برای انتشار',
    autoPublish: 'انتشار خودکار نظر',
    minCommentLength: 'حداقل طول متن نظر',
    nearMeDefaultRadiusKm: 'شعاع نزدیک من (کیلومتر)',
    featuredBoost: 'اولویت زیباگر ویژه',
    otpTtlSeconds: 'اعتبار OTP (ثانیه)',
    maxOtpAttempts: 'حداکثر تلاش OTP',
    loginRateLimitPerMinute: 'محدودیت ورود در دقیقه',
    defaultLocationPrecision: 'دقت پیش‌فرض مکان',
    showPhoneToCustomer: 'نمایش شماره به مشتری',
    siteName: 'نام سایت',
    supportPhone: 'تلفن پشتیبانی',
    maintenanceMode: 'حالت تعمیرات',
  };
  return map[key] || key;
}
