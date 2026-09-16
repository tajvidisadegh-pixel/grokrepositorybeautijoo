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
  layout?: 'image-background' | 'image-side' | 'gradient-only';
  overlayOpacity?: number;
  minHeight?: number;
  textAlign?: 'center' | 'right' | 'left';
  textColor?: 'auto' | 'light' | 'dark';
  searchPlaceholder?: string;
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

type BlockId = 'hero' | 'categories' | 'featured' | 'cta' | 'layout';



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
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(
        res.ok ? 'پاسخ سرور معتبر نبود' : `آپلود ناموفق بود (${res.status})`,
      );
    }
  }
  if (!res.ok) {
    const msg = data?.message;
    const message =
      typeof msg === 'string'
        ? msg
        : Array.isArray(msg)
          ? msg.join(', ')
          : `آپلود ناموفق بود (${res.status})`;
    throw new Error(message);
  }
  let url = String(
    (data.publicUrl as string) ||
      (data.url as string) ||
      ((data.data as Record<string, unknown> | undefined)?.publicUrl as string) ||
      ((data.data as Record<string, unknown> | undefined)?.url as string) ||
      '',
  ).trim();
  if (!url) {
    throw new Error('آدرس تصویر در پاسخ سرور نبود. دوباره تلاش کنید.');
  }
  if (url.startsWith('/')) {
    try {
      const origin = new URL(API_URL).origin;
      if (url.startsWith('/files/')) url = `${origin}/api/v1${url}`;
      else if (url.startsWith('/api/')) url = `${origin}${url}`;
      else url = `${origin}${url}`;
    } catch {
      /* keep relative */
    }
  }
  return url;
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
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<BlockId>('hero');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

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
      (cms.published as CmsContent | null | undefined)?.publishedAt || cms.published?.updatedAt || null,
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
      setMessage('تصویر آپلود شد — ذخیره یا انتشار کنید');
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
      const result = await apiClient.post<{ publishedAt?: string }>('/admin/site-cms/publish', {});
      await triggerRevalidate();
      setMessage('منتشر شد — صفحه اصلی به‌روز شد');
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

  const blocks = useMemo(
    () => [
      { id: 'hero' as const, title: 'بنر / Hero', desc: 'تصویر، عنوان، جستجو' },
      { id: 'categories' as const, title: 'دسته‌بندی‌ها', desc: 'عنوان و نمایش' },
      { id: 'featured' as const, title: 'زیباگرهای برتر', desc: 'عنوان و لینک' },
      { id: 'cta' as const, title: 'نوار CTA', desc: 'متن و دکمه‌ها' },
      { id: 'layout' as const, title: 'چیدمان صفحه', desc: 'ترتیب و فعال/غیرفعال' },
    ],
    [],
  );

  const orderedSections = sections
    .filter((s) => s.enabled !== false)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const hasBanner = Boolean(hero.desktopImageUrl || hero.mobileImageUrl);
  const overlayPct = Math.min(90, Math.max(0, Number(hero.overlayOpacity ?? 40)));
  const layout = hero.layout || (hasBanner ? 'image-background' : 'gradient-only');

  return (
    <div className="min-h-screen bg-[#f0f0f1]" dir="rtl">
      <header className="sticky top-0 z-30 border-b border-[#c3c4c7] bg-[#1d2327] text-white shadow-sm">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-wide">ویرایشگر صفحه اصلی</span>
            <span className="hidden rounded bg-white/10 px-2 py-0.5 text-[11px] text-white/70 sm:inline">
              شبیه ویرایشگر بلوکی
            </span>
            {(hasUnpublished || dirty) && (
              <span className="rounded bg-amber-500/90 px-2 py-0.5 text-[11px] font-medium text-black">
                پیش‌نویس ذخیره‌نشده / منتشرنشده
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-white/20 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPreviewMode('desktop')}
                className={`rounded-md px-2.5 py-1 ${
                  previewMode === 'desktop' ? 'bg-white text-[#1d2327]' : 'text-white/80'
                }`}
              >
                دسکتاپ
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={`rounded-md px-2.5 py-1 ${
                  previewMode === 'mobile' ? 'bg-white text-[#1d2327]' : 'text-white/80'
                }`}
              >
                موبایل
              </button>
            </div>
            <button
              disabled={busy}
              onClick={() => void saveDraft()}
              className="rounded-lg border border-white/30 bg-transparent px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              ذخیره پیش‌نویس
            </button>
            <button
              disabled={busy}
              onClick={() => void publish()}
              className="rounded-lg bg-[#2271b1] px-3 py-1.5 text-sm font-medium hover:bg-[#135e96] disabled:opacity-50"
            >
              انتشار
            </button>
          </div>
        </div>
      </header>

      {(error || message) && (
        <div className="mx-auto max-w-[1400px] space-y-2 px-3 pt-3">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {message && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-[#2271b1]">{message}</div>
          )}
        </div>
      )}

      <div className="mx-auto grid max-w-[1400px] gap-0 lg:grid-cols-[240px_1fr_320px]">
        <aside className="border-l border-[#dcdcde] bg-white lg:min-h-[calc(100vh-48px)]">
          <div className="border-b border-[#dcdcde] px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#646970]">بلوک‌ها</p>
            <p className="mt-1 text-[11px] text-[#646970]">روی هر بخش کلیک کنید تا تنظیماتش باز شود</p>
          </div>
          <nav className="p-2">
            {blocks.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelected(b.id)}
                className={`mb-1 flex w-full flex-col rounded-lg px-3 py-2.5 text-right transition ${
                  selected === b.id ? 'bg-[#f0f6fc] ring-2 ring-[#2271b1]' : 'hover:bg-[#f6f7f7]'
                }`}
              >
                <span className="text-sm font-medium text-[#1d2327]">{b.title}</span>
                <span className="text-[11px] text-[#646970]">{b.desc}</span>
              </button>
            ))}
          </nav>
          {publishedAt && (
            <div className="mt-4 border-t border-[#dcdcde] px-3 py-3 text-[11px] text-[#646970]">
              آخرین انتشار:
              <br />
              <span className="text-[#1d2327]">{new Date(publishedAt).toLocaleString('fa-IR')}</span>
            </div>
          )}
        </aside>

        <main className="bg-[#f0f0f1] p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-[#646970]">
            <span>پیش‌نمایش زنده (پیش‌نویس)</span>
            <a href="/" target="_blank" rel="noreferrer" className="text-[#2271b1] hover:underline">
              باز کردن سایت منتشرشده ↗
            </a>
          </div>
          <div
            className={`mx-auto overflow-hidden rounded-xl border border-[#c3c4c7] bg-white shadow-md transition-all ${
              previewMode === 'mobile' ? 'max-w-[390px]' : 'max-w-4xl'
            }`}
          >
            <div className="max-h-[calc(100vh-140px)] overflow-y-auto">
              {(orderedSections.length
                ? orderedSections.map((s) => s.id)
                : ['hero', 'categories', 'featured', 'cta']
              ).map((id) => {
                if (id === 'hero' && hero.enabled !== false) {
                  const forceLight =
                    hero.textColor === 'light' ||
                    (hero.textColor !== 'dark' && hasBanner && layout === 'image-background');
                  return (
                    <div
                      key="hero"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected('hero')}
                      onKeyDown={(e) => e.key === 'Enter' && setSelected('hero')}
                      className={`relative cursor-pointer outline-none ring-offset-2 ${
                        selected === 'hero' ? 'ring-2 ring-[#2271b1]' : ''
                      }`}
                      style={{
                        minHeight:
                          hasBanner && layout === 'image-background'
                            ? Number(hero.minHeight ?? 360)
                            : undefined,
                      }}
                    >
                      {hasBanner && layout === 'image-background' ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              (previewMode === 'mobile'
                                ? hero.mobileImageUrl || hero.desktopImageUrl
                                : hero.desktopImageUrl || hero.mobileImageUrl) || ''
                            }
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black" style={{ opacity: overlayPct / 100 }} />
                        </>
                      ) : layout === 'image-side' && hasBanner ? (
                        <div className="grid gap-0 md:grid-cols-2">
                          <div className="flex flex-col justify-center bg-white p-6 text-right">
                            {hero.badge && <p className="mb-2 text-xs font-semibold text-[#FF6F61]">{hero.badge}</p>}
                            <p className="text-xl font-bold text-[#0B2C4A]">{hero.title || 'عنوان'}</p>
                            {hero.subtitle && <p className="mt-1 text-base text-gray-800">{hero.subtitle}</p>}
                            {hero.description && <p className="mt-2 text-sm text-gray-600">{hero.description}</p>}
                          </div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={(hero.desktopImageUrl || hero.mobileImageUrl)!}
                            alt=""
                            className="h-48 w-full object-cover md:h-full md:min-h-[240px]"
                          />
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-white to-orange-50" />
                      )}
                      {layout !== 'image-side' && (
                        <div className="relative px-6 py-12 text-center">
                          {hero.badge && (
                            <p className={`mb-2 text-xs font-semibold ${forceLight ? 'text-orange-200' : 'text-[#FF6F61]'}`}>
                              {hero.badge}
                            </p>
                          )}
                          <p className={`text-2xl font-bold ${forceLight ? 'text-white' : 'text-[#0B2C4A]'}`}>
                            {hero.title || 'عنوان Hero'}
                          </p>
                          {hero.subtitle && (
                            <p className={`mt-1 text-lg ${forceLight ? 'text-white/95' : 'text-gray-800'}`}>{hero.subtitle}</p>
                          )}
                          {hero.description && (
                            <p className={`mx-auto mt-2 max-w-md text-sm ${forceLight ? 'text-white/85' : 'text-gray-600'}`}>
                              {hero.description}
                            </p>
                          )}
                          {features.showSearchInHero !== false && (
                            <div className="mx-auto mt-5 flex max-w-sm gap-2">
                              <div className="h-10 flex-1 rounded-xl border bg-white px-3 text-right text-xs leading-10 text-gray-400">
                                {hero.searchPlaceholder || 'جستجو...'}
                              </div>
                              <div className="flex h-10 items-center rounded-xl bg-[#FF6F61] px-4 text-xs text-white">
                                {hero.ctaText || 'جستجو'}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
                if (id === 'categories' && features.showCategories !== false) {
                  return (
                    <div
                      key="categories"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected('categories')}
                      className={`cursor-pointer px-6 py-8 ${selected === 'categories' ? 'ring-2 ring-inset ring-[#2271b1]' : ''}`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-bold text-[#0B2C4A]">{texts.categoriesTitle || 'دسته‌بندی‌های محبوب'}</span>
                        <span className="text-sm text-[#FF6F61]">{texts.categoriesLinkText || 'همه خدمات'}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <div key={n} className="rounded-xl border bg-gray-50 py-4 text-center text-[11px] text-gray-400">دسته</div>
                        ))}
                      </div>
                    </div>
                  );
                }
                if (id === 'featured' && features.showFeaturedProfessionals !== false) {
                  return (
                    <div
                      key="featured"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected('featured')}
                      className={`cursor-pointer px-6 py-8 ${selected === 'featured' ? 'ring-2 ring-inset ring-[#2271b1]' : ''}`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-bold text-[#0B2C4A]">{texts.featuredTitle || 'زیباگرهای برتر هفته'}</span>
                        <span className="text-sm text-[#FF6F61]">{texts.featuredLinkText || 'مشاهده همه'}</span>
                      </div>
                      <div className="flex gap-2 overflow-hidden">
                        {[1, 2, 3].map((n) => (
                          <div key={n} className="h-24 w-32 shrink-0 rounded-xl border bg-gray-50 text-center text-[11px] leading-[6rem] text-gray-400">کارت</div>
                        ))}
                      </div>
                    </div>
                  );
                }
                if (id === 'cta' && features.showBottomCta !== false) {
                  return (
                    <div
                      key="cta"
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected('cta')}
                      className={`cursor-pointer bg-[#0B2C4A] px-6 py-10 text-center text-white ${selected === 'cta' ? 'ring-2 ring-inset ring-[#2271b1]' : ''}`}
                    >
                      <p className="text-lg font-bold">{texts.ctaTitle || 'آماده رزرو هستید؟'}</p>
                      <p className="mt-1 text-sm text-white/80">{texts.ctaDescription || 'زیباگر را انتخاب کنید و نوبت بگیرید.'}</p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <span className="rounded-lg bg-[#FF6F61] px-3 py-1.5 text-xs">{texts.ctaPrimaryText || 'شروع جستجو'}</span>
                        <span className="rounded-lg border border-white/40 px-3 py-1.5 text-xs">{texts.ctaSecondaryText || 'ثبت‌نام رایگان'}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </main>

        <aside className="border-r border-[#dcdcde] bg-white lg:min-h-[calc(100vh-48px)]">
          <div className="border-b border-[#dcdcde] px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#646970]">تنظیمات</p>
            <p className="mt-0.5 text-sm font-medium text-[#1d2327]">{blocks.find((b) => b.id === selected)?.title}</p>
          </div>
          <div className="max-h-[calc(100vh-120px)] space-y-4 overflow-y-auto p-3">
            {selected === 'hero' && (
              <>
                <Toggle label="نمایش بنر" checked={hero.enabled !== false} onChange={(v) => patchHero({ enabled: v })} />
                <Select
                  label="چیدمان بنر"
                  value={hero.layout || 'image-background'}
                  onChange={(v) => patchHero({ layout: v as Hero['layout'] })}
                  options={[
                    { value: 'image-background', label: 'تصویر پس‌زمینه (کامل و واضح)' },
                    { value: 'image-side', label: 'تصویر کنار متن' },
                    { value: 'gradient-only', label: 'فقط گرادیان (بدون تصویر)' },
                  ]}
                />
                <Field label="نشان (badge)" value={hero.badge || ''} onChange={(v) => patchHero({ badge: v })} />
                <Field label="عنوان" value={hero.title || ''} onChange={(v) => patchHero({ title: v })} />
                <Field label="زیرعنوان" value={hero.subtitle || ''} onChange={(v) => patchHero({ subtitle: v })} />
                <Field label="توضیحات" value={hero.description || ''} onChange={(v) => patchHero({ description: v })} multiline />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="متن دکمه" value={hero.ctaText || ''} onChange={(v) => patchHero({ ctaText: v })} />
                  <Field label="لینک دکمه" value={hero.ctaLink || ''} onChange={(v) => patchHero({ ctaLink: v })} />
                </div>
                <Field label="متن placeholder جستجو" value={hero.searchPlaceholder || ''} onChange={(v) => patchHero({ searchPlaceholder: v })} />
                <Toggle label="نمایش جستجو در بنر" checked={features.showSearchInHero !== false} onChange={(v) => patchFeatures({ showSearchInHero: v })} />
                <div className="rounded-lg border border-[#dcdcde] p-3">
                  <p className="mb-2 text-xs font-semibold text-[#1d2327]">رسانه بنر</p>
                  <MediaSlot label="تصویر دسکتاپ" url={hero.desktopImageUrl} uploading={uploading === 'desktop'} onUrl={(v) => patchHero({ desktopImageUrl: v })} onFile={(f) => void onUpload('desktop', f)} onClear={() => patchHero({ desktopImageUrl: null })} />
                  <div className="mt-3">
                    <MediaSlot label="تصویر موبایل" url={hero.mobileImageUrl} uploading={uploading === 'mobile'} onUrl={(v) => patchHero({ mobileImageUrl: v })} onFile={(f) => void onUpload('mobile', f)} onClear={() => patchHero({ mobileImageUrl: null })} />
                  </div>
                </div>
                <Range label={`تاریکی روی تصویر (فقط برای خوانایی متن): ${overlayPct}%`} value={overlayPct} min={0} max={80} onChange={(v) => patchHero({ overlayOpacity: v })} />
                <p className="text-[11px] text-[#646970]">برای بنر کاملاً واضح، عدد را نزدیک ۰ بگذارید. برای خوانایی متن روی تصویر شلوغ، ۳۰–۵۰ مناسب است.</p>
                <Range label={`حداقل ارتفاع بنر: ${hero.minHeight ?? 420}px`} value={Number(hero.minHeight ?? 420)} min={280} max={700} onChange={(v) => patchHero({ minHeight: v })} />
                <Select label="تراز متن" value={hero.textAlign || 'center'} onChange={(v) => patchHero({ textAlign: v as Hero['textAlign'] })} options={[{ value: 'center', label: 'وسط' }, { value: 'right', label: 'راست' }, { value: 'left', label: 'چپ' }]} />
                <Select label="رنگ متن" value={hero.textColor || 'auto'} onChange={(v) => patchHero({ textColor: v as Hero['textColor'] })} options={[{ value: 'auto', label: 'خودکار (روشن روی تصویر)' }, { value: 'light', label: 'روشن (سفید)' }, { value: 'dark', label: 'تیره' }]} />
              </>
            )}

            {selected === 'categories' && (
              <>
                <Toggle label="نمایش بخش دسته‌بندی‌ها" checked={features.showCategories !== false} onChange={(v) => patchFeatures({ showCategories: v })} />
                <Field label="عنوان بخش" value={texts.categoriesTitle || ''} onChange={(v) => patchTexts({ categoriesTitle: v })} />
                <Field label="متن لینک «همه»" value={texts.categoriesLinkText || ''} onChange={(v) => patchTexts({ categoriesLinkText: v })} />
              </>
            )}

            {selected === 'featured' && (
              <>
                <Toggle label="نمایش زیباگرهای برتر" checked={features.showFeaturedProfessionals !== false} onChange={(v) => patchFeatures({ showFeaturedProfessionals: v })} />
                <Field label="عنوان بخش" value={texts.featuredTitle || ''} onChange={(v) => patchTexts({ featuredTitle: v })} />
                <Field label="متن لینک «مشاهده همه»" value={texts.featuredLinkText || ''} onChange={(v) => patchTexts({ featuredLinkText: v })} />
              </>
            )}

            {selected === 'cta' && (
              <>
                <Toggle label="نمایش نوار CTA" checked={features.showBottomCta !== false} onChange={(v) => patchFeatures({ showBottomCta: v })} />
                <Field label="عنوان" value={texts.ctaTitle || ''} onChange={(v) => patchTexts({ ctaTitle: v })} />
                <Field label="توضیح" value={texts.ctaDescription || ''} onChange={(v) => patchTexts({ ctaDescription: v })} multiline />
                <Field label="متن دکمه اصلی" value={texts.ctaPrimaryText || ''} onChange={(v) => patchTexts({ ctaPrimaryText: v })} />
                <Field label="لینک دکمه اصلی" value={texts.ctaPrimaryLink || ''} onChange={(v) => patchTexts({ ctaPrimaryLink: v })} />
                <Field label="متن دکمه ثانویه" value={texts.ctaSecondaryText || ''} onChange={(v) => patchTexts({ ctaSecondaryText: v })} />
                <Field label="لینک دکمه ثانویه" value={texts.ctaSecondaryLink || ''} onChange={(v) => patchTexts({ ctaSecondaryLink: v })} />
              </>
            )}

            {selected === 'layout' && (
              <>
                <p className="text-xs text-[#646970]">ترتیب بخش‌ها را با دکمه‌های بالا/پایین تنظیم کنید. غیرفعال کردن بخش آن را از صفحه حذف می‌کند.</p>
                <div className="space-y-2">
                  {sections.map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-[#dcdcde] bg-[#f6f7f7] px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#646970]">#{i + 1}</span>
                        <span className="text-sm font-medium text-[#1d2327]">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="flex items-center gap-1 text-[11px]">
                          <input
                            type="checkbox"
                            checked={s.enabled}
                            onChange={(e) => {
                              markDirty();
                              setSections((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: e.target.checked } : x)));
                            }}
                          />
                          فعال
                        </label>
                        <button type="button" disabled={i === 0} onClick={() => moveSection(i, -1)} className="rounded bg-white px-1.5 py-0.5 text-[11px] shadow-sm disabled:opacity-40">↑</button>
                        <button type="button" disabled={i === sections.length - 1} onClick={() => moveSection(i, 1)} className="rounded bg-white px-1.5 py-0.5 text-[11px] shadow-sm disabled:opacity-40">↓</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-[#1d2327]">{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full rounded border border-[#8c8f94] px-2 py-1.5 text-sm outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded border border-[#8c8f94] px-2 text-sm outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]" />
      )}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
      <span className="text-[#1d2327]">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[#2271b1]" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-[#1d2327]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded border border-[#8c8f94] bg-white px-2 text-sm outline-none focus:border-[#2271b1]">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function Range({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-[#1d2327]">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#2271b1]" />
    </label>
  );
}

function MediaSlot({ label, url, uploading, onUrl, onFile, onClear }: { label: string; url?: string | null; uploading: boolean; onUrl: (v: string | null) => void; onFile: (f: File | null) => void; onClear: () => void }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-[#646970]">{label}</p>
      {url ? (
        <div className="relative mb-2 overflow-hidden rounded-lg border border-[#dcdcde]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-28 w-full object-cover" />
          <button type="button" onClick={onClear} className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">حذف</button>
        </div>
      ) : (
        <div className="mb-2 flex h-28 items-center justify-center rounded-lg border border-dashed border-[#c3c4c7] bg-[#f6f7f7] text-[11px] text-[#646970]">هنوز تصویری انتخاب نشده</div>
      )}
      <input type="file" accept="image/*" disabled={uploading} className="mb-1 block w-full text-[11px]" onChange={(e) => onFile(e.target.files?.[0] || null)} />
      {uploading && <p className="text-[11px] text-[#2271b1]">در حال آپلود…</p>}
      <input value={url || ''} onChange={(e) => onUrl(e.target.value || null)} placeholder="یا URL تصویر" className="mt-1 h-8 w-full rounded border border-[#8c8f94] px-2 text-xs" />
    </div>
  );
}
