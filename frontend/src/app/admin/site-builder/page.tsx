'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, API_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth-storage';

type Hero = {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  description?: string;
  ctaText?: string;
  ctaLink?: string;
  badge?: string;
  desktopImageUrl?: string | null;
  mobileImageUrl?: string | null;
};

type Texts = {
  categoriesTitle?: string;
  categoriesLinkText?: string;
  featuredTitle?: string;
  featuredLinkText?: string;
  ctaTitle?: string;
  ctaDescription?: string;
  ctaPrimaryText?: string;
  ctaPrimaryLink?: string;
  ctaSecondaryText?: string;
  ctaSecondaryLink?: string;
};

type Features = {
  showCategories?: boolean;
  showFeaturedProfessionals?: boolean;
  showBottomCta?: boolean;
  showSearchInHero?: boolean;
};

type CmsContent = {
  hero?: Hero;
  texts?: Texts;
  features?: Features;
  version?: number;
  updatedAt?: string | null;
  publishedAt?: string | null;
};

type Section = { id: string; label: string; enabled: boolean; sortOrder: number };

type CmsPayload = {
  draft?: CmsContent;
  published?: CmsContent | null;
  hasUnpublishedChanges?: boolean;
};

type BuilderPayload = {
  draft?: { sections?: Section[] };
  published?: { sections?: Section[] } | null;
  hasUnpublishedChanges?: boolean;
};

async function uploadCmsImage(file: File, slot: string): Promise<string> {
  const token = getAccessToken();
  const form = new FormData();
  form.append('file', file);
  form.append('slot', slot);
  const res = await fetch(`${API_URL}/admin/site-cms/upload`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.message === 'string' ? data.message : 'آپلود ناموفق بود');
  }
  return String(data.publicUrl || '');
}

async function triggerRevalidate() {
  try {
    const secret =
      (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_REVALIDATE_SECRET) || '';
    await fetch('/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, path: '/' }),
    });
  } catch {
    /* non-blocking */
  }
}

export default function AdminSiteBuilderPage() {
  const [content, setContent] = useState<CmsContent>({});
  const [sections, setSections] = useState<Section[]>([]);
  const [hasUnpublished, setHasUnpublished] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'hero' | 'sections' | 'texts' | 'features' | 'preview'>('hero');
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const [cms, builder] = await Promise.all([
      apiClient.get<CmsPayload>('/admin/content'),
      apiClient.get<BuilderPayload>('/admin/site-builder'),
    ]);
    setContent(cms.draft || {});
    setSections((builder.draft?.sections || []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
    setHasUnpublished(!!(cms.hasUnpublishedChanges || builder.hasUnpublishedChanges));
    setPublishedAt(
      (cms.published as CmsContent | null | undefined)?.publishedAt ||
        cms.published?.updatedAt ||
        null,
    );
    setDirty(false);
  }, []);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'بارگذاری ناموفق بود'));
  }, [load]);

  const hero = content.hero || {};
  const texts = content.texts || {};
  const features = content.features || {};

  function markDirty() {
    setDirty(true);
    setHasUnpublished(true);
  }

  function patchHero(patch: Partial<Hero>) {
    markDirty();
    setContent((c) => ({ ...c, hero: { ...(c.hero || {}), ...patch } }));
  }
  function patchTexts(patch: Partial<Texts>) {
    markDirty();
    setContent((c) => ({ ...c, texts: { ...(c.texts || {}), ...patch } }));
  }
  function patchFeatures(patch: Partial<Features>) {
    markDirty();
    setContent((c) => ({ ...c, features: { ...(c.features || {}), ...patch } }));
  }

  function moveSection(index: number, dir: -1 | 1) {
    markDirty();
    setSections((prev) => {
      const next = prev.slice();
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      return next.map((s, i) => ({ ...s, sortOrder: i }));
    });
  }

  async function onUpload(slot: 'desktop' | 'mobile', file: File | null) {
    if (!file) return;
    setUploading(slot);
    setError(null);
    try {
      const url = await uploadCmsImage(file, slot);
      if (!url) throw new Error('آدرس تصویر برنگشت');
      if (slot === 'desktop') patchHero({ desktopImageUrl: url });
      else patchHero({ mobileImageUrl: url });
      setMessage('تصویر آپلود شد — حتماً پیش‌نویس را ذخیره یا منتشر کنید');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'آپلود ناموفق بود');
    } finally {
      setUploading(null);
    }
  }

  async function saveDraft() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await Promise.all([
        apiClient.put('/admin/content', {
          hero: content.hero,
          texts: content.texts,
          features: content.features,
        }),
        apiClient.put('/admin/site-builder', sections),
      ]);
      setMessage('پیش‌نویس ذخیره شد');
      await load();
      setHasUnpublished(true);
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!confirm('تغییرات روی سایت عمومی منتشر شود؟')) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await Promise.all([
        apiClient.put('/admin/content', {
          hero: content.hero,
          texts: content.texts,
          features: content.features,
        }),
        apiClient.put('/admin/site-builder', sections),
      ]);
      const result = await apiClient.post<{
        success?: boolean;
        publishedAt?: string;
        hasUnpublishedChanges?: boolean;
      }>('/admin/site-cms/publish', {});
      await triggerRevalidate();
      setMessage('منتشر شد — صفحه اصلی با نسخه جدید به‌روز می‌شود');
      setHasUnpublished(false);
      setDirty(false);
      if (result?.publishedAt) setPublishedAt(result.publishedAt);
      await load();
      setHasUnpublished(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'انتشار ناموفق بود');
    } finally {
      setBusy(false);
    }
  }

  const tabs = useMemo(
    () =>
      [
        { id: 'hero' as const, label: 'Hero / بنر' },
        { id: 'sections' as const, label: 'بخش‌ها و ترتیب' },
        { id: 'texts' as const, label: 'متن‌ها' },
        { id: 'features' as const, label: 'قابلیت‌ها' },
        { id: 'preview' as const, label: 'پیش‌نمایش' },
      ] as const,
    [],
  );

  const orderedSections = sections
    .filter((s) => s.enabled !== false)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0B2C4A]">طراحی سایت</h1>
          <p className="mt-1 text-sm text-gray-500">
            ویرایش محتوای صفحه اصلی — ذخیره پیش‌نویس، پیش‌نمایش، سپس انتشار
          </p>
          {publishedAt && (
            <p className="mt-1 text-xs text-gray-400">
              آخرین انتشار: {new Date(publishedAt).toLocaleString('fa-IR')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => setTab('preview')}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            پیش‌نمایش
          </button>
          <button
            disabled={busy}
            onClick={() => void saveDraft()}
            className="rounded-xl border border-[#2D6CDF] px-4 py-2 text-sm font-medium text-[#2D6CDF] disabled:opacity-50"
          >
            ذخیره پیش‌نویس
          </button>
          <button
            disabled={busy}
            onClick={() => void publish()}
            className="rounded-xl bg-[#FF6F61] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            انتشار
          </button>
        </div>
      </div>

      {(hasUnpublished || dirty) && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          تغییرات پیش‌نویس هنوز منتشر نشده‌اند.
        </div>
      )}
      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && (
        <div className="rounded-xl bg-[#E7F1FF] px-3 py-2 text-sm text-[#2D6CDF]">{message}</div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === t.id ? 'bg-[#0B2C4A] text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'hero' && (
        <section className="space-y-3 rounded-2xl border border-[#E7F1FF] bg-white p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={hero.enabled !== false}
              onChange={(e) => patchHero({ enabled: e.target.checked })}
            />
            نمایش Hero
          </label>
          <Field label="نشان (badge)" value={hero.badge || ''} onChange={(v) => patchHero({ badge: v })} />
          <Field label="عنوان" value={hero.title || ''} onChange={(v) => patchHero({ title: v })} />
          <Field label="زیرعنوان" value={hero.subtitle || ''} onChange={(v) => patchHero({ subtitle: v })} />
          <Field
            label="توضیحات"
            value={hero.description || ''}
            onChange={(v) => patchHero({ description: v })}
            multiline
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="متن دکمه" value={hero.ctaText || ''} onChange={(v) => patchHero({ ctaText: v })} />
            <Field label="لینک دکمه" value={hero.ctaLink || ''} onChange={(v) => patchHero({ ctaLink: v })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Field
                label="URL تصویر دسکتاپ"
                value={hero.desktopImageUrl || ''}
                onChange={(v) => patchHero({ desktopImageUrl: v || null })}
              />
              <label className="mt-2 block text-xs text-gray-500">
                یا آپلود فایل
                <input
                  type="file"
                  accept="image/*"
                  disabled={!!uploading}
                  className="mt-1 block w-full text-xs"
                  onChange={(e) => void onUpload('desktop', e.target.files?.[0] || null)}
                />
                {uploading === 'desktop' && <span className="text-[#2D6CDF]">در حال آپلود…</span>}
              </label>
            </div>
            <div>
              <Field
                label="URL تصویر موبایل"
                value={hero.mobileImageUrl || ''}
                onChange={(v) => patchHero({ mobileImageUrl: v || null })}
              />
              <label className="mt-2 block text-xs text-gray-500">
                یا آپلود فایل
                <input
                  type="file"
                  accept="image/*"
                  disabled={!!uploading}
                  className="mt-1 block w-full text-xs"
                  onChange={(e) => void onUpload('mobile', e.target.files?.[0] || null)}
                />
                {uploading === 'mobile' && <span className="text-[#2D6CDF]">در حال آپلود…</span>}
              </label>
            </div>
          </div>
        </section>
      )}

      {tab === 'sections' && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-sm text-gray-500">ترتیب با دکمه‌های بالا/پایین تغییر می‌کند.</p>
          <div className="divide-y">
            {sections.map((s, i) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">#{i + 1}</span>
                  <span className="text-sm font-medium text-[#0B2C4A]">{s.label}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => {
                        markDirty();
                        setSections((prev) =>
                          prev.map((x) => (x.id === s.id ? { ...x, enabled: e.target.checked } : x)),
                        );
                      }}
                    />
                    فعال
                  </label>
                  <button type="button" disabled={i === 0} onClick={() => moveSection(i, -1)} className="rounded-lg bg-gray-100 px-2 py-1 text-xs disabled:opacity-40">
                    بالا
                  </button>
                  <button type="button" disabled={i === sections.length - 1} onClick={() => moveSection(i, 1)} className="rounded-lg bg-gray-100 px-2 py-1 text-xs disabled:opacity-40">
                    پایین
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'texts' && (
        <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
          <Field label="عنوان دسته‌بندی‌ها" value={texts.categoriesTitle || ''} onChange={(v) => patchTexts({ categoriesTitle: v })} />
          <Field label="لینک همه خدمات" value={texts.categoriesLinkText || ''} onChange={(v) => patchTexts({ categoriesLinkText: v })} />
          <Field label="عنوان زیباگرهای برتر" value={texts.featuredTitle || ''} onChange={(v) => patchTexts({ featuredTitle: v })} />
          <Field label="لینک مشاهده همه" value={texts.featuredLinkText || ''} onChange={(v) => patchTexts({ featuredLinkText: v })} />
          <Field label="عنوان CTA" value={texts.ctaTitle || ''} onChange={(v) => patchTexts({ ctaTitle: v })} />
          <Field label="توضیح CTA" value={texts.ctaDescription || ''} onChange={(v) => patchTexts({ ctaDescription: v })} multiline />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="متن دکمه اصلی CTA" value={texts.ctaPrimaryText || ''} onChange={(v) => patchTexts({ ctaPrimaryText: v })} />
            <Field label="لینک دکمه اصلی" value={texts.ctaPrimaryLink || ''} onChange={(v) => patchTexts({ ctaPrimaryLink: v })} />
            <Field label="متن دکمه ثانویه" value={texts.ctaSecondaryText || ''} onChange={(v) => patchTexts({ ctaSecondaryText: v })} />
            <Field label="لینک دکمه ثانویه" value={texts.ctaSecondaryLink || ''} onChange={(v) => patchTexts({ ctaSecondaryLink: v })} />
          </div>
        </section>
      )}

      {tab === 'features' && (
        <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
          {(
            [
              ['showSearchInHero', 'جستجو در Hero'],
              ['showCategories', 'بخش دسته‌بندی‌ها'],
              ['showFeaturedProfessionals', 'زیباگرهای برتر'],
              ['showBottomCta', 'نوار CTA پایین'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={features[key] !== false}
                onChange={(e) => patchFeatures({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </section>
      )}

      {tab === 'preview' && (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-2 text-xs text-gray-500">
            پیش‌نمایش زنده از پیش‌نویس فعلی (قبل از انتشار روی سایت عمومی)
            {dirty && ' · تغییرات ذخیره‌نشده در فرم لحاظ شده‌اند'}
          </div>
          <div className="max-h-[70vh] overflow-y-auto" dir="rtl">
            {(orderedSections.length
              ? orderedSections.map((s) => s.id)
              : ['hero', 'categories', 'featured', 'cta']
            ).map((id) => {
              if (id === 'hero' && hero.enabled !== false) {
                return (
                  <div
                    key="hero"
                    className="relative bg-gradient-to-b from-sky-50 via-white to-orange-50 px-6 py-10 text-center"
                  >
                    {hero.desktopImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hero.desktopImageUrl}
                        alt=""
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15"
                      />
                    ) : null}
                    <div className="relative">
                      {hero.badge ? (
                        <p className="mb-2 text-xs font-semibold text-[#FF6F61]">{hero.badge}</p>
                      ) : null}
                      <h2 className="text-2xl font-bold text-[#0B2C4A] sm:text-3xl">
                        {hero.title || 'عنوان Hero'}
                        {hero.subtitle ? (
                          <span className="mt-1 block text-lg text-gray-800">{hero.subtitle}</span>
                        ) : null}
                      </h2>
                      {hero.description ? (
                        <p className="mx-auto mt-3 max-w-lg text-sm text-gray-600">{hero.description}</p>
                      ) : null}
                      {features.showSearchInHero !== false && (
                        <div className="mx-auto mt-5 flex max-w-md gap-2">
                          <div className="h-10 flex-1 rounded-xl border bg-white px-3 text-right text-sm leading-10 text-gray-400">
                            جستجوی خدمت یا زیباگر...
                          </div>
                          <div className="flex h-10 items-center rounded-xl bg-[#FF6F61] px-4 text-sm text-white">
                            {hero.ctaText || 'جستجو'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              if (id === 'categories' && features.showCategories !== false) {
                return (
                  <div key="categories" className="px-6 py-8">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-bold text-[#0B2C4A]">
                        {texts.categoriesTitle || 'دسته‌بندی‌های محبوب'}
                      </h3>
                      <span className="text-sm text-[#FF6F61]">
                        {texts.categoriesLinkText || 'همه خدمات'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {['۱', '۲', '۳', '۴', '۵', '۶'].map((n) => (
                        <div
                          key={n}
                          className="rounded-xl border bg-gray-50 py-4 text-center text-xs text-gray-500"
                        >
                          دسته {n}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              if (id === 'featured' && features.showFeaturedProfessionals !== false) {
                return (
                  <div key="featured" className="px-6 py-8">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-bold text-[#0B2C4A]">
                        {texts.featuredTitle || 'زیباگرهای برتر هفته'}
                      </h3>
                      <span className="text-sm text-[#FF6F61]">
                        {texts.featuredLinkText || 'مشاهده همه'}
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {[1, 2, 3].map((n) => (
                        <div
                          key={n}
                          className="h-28 w-40 shrink-0 rounded-xl border bg-gray-50 text-center text-xs leading-[7rem] text-gray-400"
                        >
                          کارت زیباگر
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              if (id === 'cta' && features.showBottomCta !== false) {
                return (
                  <div key="cta" className="bg-[#0B2C4A] px-6 py-10 text-center text-white">
                    <h3 className="text-xl font-bold">{texts.ctaTitle || 'آماده رزرو هستید؟'}</h3>
                    <p className="mt-2 text-sm text-white/80">
                      {texts.ctaDescription ||
                        'زیباگر را انتخاب کنید، زمان آزاد را ببینید و نوبت بگیرید.'}
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      <span className="rounded-xl bg-[#FF6F61] px-4 py-2 text-sm">
                        {texts.ctaPrimaryText || 'شروع جستجو'}
                      </span>
                      <span className="rounded-xl border border-white/40 px-4 py-2 text-sm">
                        {texts.ctaSecondaryText || 'ثبت‌نام رایگان'}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
          <div className="border-t bg-gray-50 px-4 py-3 text-center">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-[#2D6CDF] hover:underline"
            >
              باز کردن صفحه اصلی سایت (نسخه منتشرشده)
            </a>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-600">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2D6CDF]"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#2D6CDF]"
        />
      )}
    </label>
  );
}
