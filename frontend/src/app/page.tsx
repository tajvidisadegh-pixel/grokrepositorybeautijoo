import Link from 'next/link';
import { Search, Scissors, Sparkles, Hand, Eye, Smile, Heart } from 'lucide-react';
import type { Metadata } from 'next';
import {
  listCategories,
  searchProfessionals,
  getPublishedSiteConfig,
  type PublishedSiteConfig,
} from '@/lib/public-api';
import { ProfessionalCard } from '@/components/professionals/professional-card';
import { siteName } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `${siteName()} | رزرو آنلاین خدمات زیبایی` },
  description:
    'بیوتی‌جو — رزرو آنلاین نوبت زیبایی، آسان و سریع. زیباگر مناسب خود را پیدا کنید.',
};

/** ISR fallback; on-demand via revalidateTag('site-cms') after publish */
export const revalidate = 60;

const CATEGORY_ICONS = [Scissors, Sparkles, Hand, Eye, Smile, Heart, Scissors, Sparkles];

const DEFAULT_CONTENT: PublishedSiteConfig['content'] = {
  hero: {
    enabled: true,
    title: 'بیوتی‌جو، رزرو آنلاین نوبت',
    subtitle: 'آسان و سریع',
    description: 'زیباگر مناسب خود را پیدا کنید — آرایش، ناخن، پوست و بیشتر، نزدیک شما',
    ctaText: 'جستجو',
    ctaLink: '/search',
    badge: 'بیوتی‌جو · رزرو آنلاین نوبت',
    desktopImageUrl: null,
    mobileImageUrl: null,
  },
  texts: {
    categoriesTitle: 'دسته‌بندی‌های محبوب',
    categoriesLinkText: 'همه خدمات',
    featuredTitle: 'زیباگرهای برتر هفته',
    featuredLinkText: 'مشاهده همه',
    ctaTitle: 'آماده رزرو هستید؟',
    ctaDescription: 'زیباگر را انتخاب کنید، زمان آزاد را ببینید و نوبت بگیرید.',
    ctaPrimaryText: 'شروع جستجو',
    ctaPrimaryLink: '/search',
    ctaSecondaryText: 'ثبت‌نام رایگان',
    ctaSecondaryLink: '/register',
  },
  features: {
    showCategories: true,
    showFeaturedProfessionals: true,
    showBottomCta: true,
    showSearchInHero: true,
  },
};

const DEFAULT_SECTIONS = [
  { id: 'hero', label: 'Hero', enabled: true, sortOrder: 0 },
  { id: 'categories', label: 'دسته‌بندی‌های محبوب', enabled: true, sortOrder: 1 },
  { id: 'featured', label: 'زیباگرهای برتر', enabled: true, sortOrder: 2 },
  { id: 'cta', label: 'دعوت به اقدام', enabled: true, sortOrder: 3 },
];

export default async function HomePage() {
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  let featured: Awaited<ReturnType<typeof searchProfessionals>> | null = null;
  let loadError = false;
  let content = DEFAULT_CONTENT;
  let sections = DEFAULT_SECTIONS;

  try {
    const [cats, pros, siteCfg] = await Promise.all([
      listCategories(),
      searchProfessionals({ page: 1, limit: 6 }),
      getPublishedSiteConfig().catch(() => null),
    ]);
    categories = cats;
    featured = pros;
    if (siteCfg?.content) {
      content = {
        ...DEFAULT_CONTENT,
        ...siteCfg.content,
        hero: { ...DEFAULT_CONTENT.hero, ...(siteCfg.content.hero || {}) },
        texts: { ...DEFAULT_CONTENT.texts, ...(siteCfg.content.texts || {}) },
        features: { ...DEFAULT_CONTENT.features, ...(siteCfg.content.features || {}) },
      };
    }
    if (Array.isArray(siteCfg?.sections) && siteCfg.sections.length > 0) {
      sections = siteCfg.sections.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    }
  } catch {
    loadError = true;
  }

  const hero = content.hero || DEFAULT_CONTENT.hero!;
  const texts = content.texts || DEFAULT_CONTENT.texts!;
  const features = content.features || DEFAULT_CONTENT.features!;

  const sectionEnabled = (id: string) => {
    const row = sections.find((s) => s.id === id);
    if (!row) return true;
    return row.enabled !== false;
  };

  const ordered = sections.filter((s) => s.enabled !== false).map((s) => s.id);

  function renderSection(id: string) {
    switch (id) {
      case 'hero':
        if (!sectionEnabled('hero') || hero.enabled === false) return null;
        return (
          <section
            key="hero"
            className="relative overflow-hidden bg-gradient-to-b from-blue-soft via-white to-coral-soft/30"
          >
            {hero.desktopImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.desktopImageUrl}
                alt=""
                className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover opacity-20 md:block"
              />
            ) : null}
            {hero.mobileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.mobileImageUrl}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20 md:hidden"
              />
            ) : null}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-blue/5 to-transparent" />
            <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16 md:py-20">
              <div className="mx-auto max-w-2xl text-center">
                {hero.badge ? (
                  <p className="mb-3 text-xs font-semibold tracking-wide text-coral sm:text-sm">
                    {hero.badge}
                  </p>
                ) : null}
                <h1 className="text-2xl font-bold leading-snug text-blue sm:text-3xl sm:leading-tight md:text-4xl lg:text-5xl">
                  {hero.title}
                  {hero.subtitle ? (
                    <span className="block text-foreground">{hero.subtitle}</span>
                  ) : null}
                </h1>
                {hero.description ? (
                  <p className="mt-3 text-sm leading-7 text-gray sm:mt-4 sm:text-base md:text-lg">
                    {hero.description}
                  </p>
                ) : null}
                {features.showSearchInHero !== false && (
                  <form
                    action={hero.ctaLink || '/search'}
                    method="get"
                    className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-gray-muted" />
                      <input
                        name="q"
                        type="search"
                        placeholder="جستجوی خدمت یا زیباگر..."
                        className="h-12 w-full rounded-2xl border border-border bg-white pr-11 pl-4 text-sm shadow-sm outline-none transition-colors placeholder:text-gray-muted focus:border-coral focus:ring-2 focus:ring-coral/20"
                      />
                    </div>
                    <button
                      type="submit"
                      className="h-12 shrink-0 rounded-2xl bg-coral px-8 text-sm font-medium text-white shadow-sm transition-colors hover:bg-coral-dark"
                    >
                      {hero.ctaText || 'جستجو'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>
        );
      case 'categories':
        if (features.showCategories === false || !sectionEnabled('categories')) return null;
        if (categories.length === 0) return null;
        return (
          <section key="categories" className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
            <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
              <h2 className="text-lg font-bold text-foreground sm:text-xl">
                {texts.categoriesTitle || 'دسته‌بندی‌های محبوب'}
              </h2>
              <Link
                href="/services"
                className="text-sm font-medium text-coral transition-colors hover:text-coral-dark"
              >
                {texts.categoriesLinkText || 'همه خدمات'}
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 sm:grid-cols-4 md:grid-cols-6">
              {categories.slice(0, 6).map((c, i) => {
                const Icon = CATEGORY_ICONS[i % CATEGORY_ICONS.length];
                return (
                  <Link
                    key={c.id}
                    href={`/categories/${c.slug}`}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-border/80 bg-white p-3 text-center shadow-[0_1px_2px_rgba(31,41,55,0.04)] transition-all hover:border-coral/30 hover:bg-coral-soft/50 sm:p-4"
                  >
                    <span className="flex size-11 items-center justify-center rounded-xl bg-coral-soft text-coral sm:size-12">
                      <Icon className="size-5 sm:size-6" strokeWidth={1.75} />
                    </span>
                    <span className="block text-xs font-medium text-foreground sm:text-sm line-clamp-1">
                      {c.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      case 'featured':
        if (features.showFeaturedProfessionals === false || !sectionEnabled('featured')) return null;
        return (
          <section key="featured" className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
            <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
              <h2 className="text-lg font-bold text-foreground sm:text-xl">
                {texts.featuredTitle || 'زیباگرهای برتر هفته'}
              </h2>
              <Link
                href="/professionals"
                className="text-sm font-medium text-coral transition-colors hover:text-coral-dark"
              >
                {texts.featuredLinkText || 'مشاهده همه'}
              </Link>
            </div>
            {loadError && (
              <p className="rounded-2xl bg-gray-light px-4 py-6 text-center text-sm text-gray">
                در حال حاضر امکان بارگذاری لیست زیباگران نیست. بعداً تلاش کنید.
              </p>
            )}
            {!loadError && featured && featured.items.length === 0 && (
              <p className="text-center text-sm text-gray">هنوز زیباگر تأییدشده‌ای ثبت نشده است.</p>
            )}
            {featured && featured.items.length > 0 && (
              <div
                className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scroll-smooth sm:gap-4 [scrollbar-width:thin]"
                dir="rtl"
              >
                {featured.items.map((pro) => (
                  <div key={pro.id} className="w-[min(280px,78vw)] shrink-0 snap-start sm:w-[300px]">
                    <ProfessionalCard pro={pro} />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      case 'cta':
        if (features.showBottomCta === false || !sectionEnabled('cta')) return null;
        return (
          <section key="cta" className="bg-blue">
            <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:py-14">
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                {texts.ctaTitle || 'آماده رزرو هستید؟'}
              </h2>
              <p className="mt-2 text-sm text-white/80 sm:text-base">
                {texts.ctaDescription ||
                  'زیباگر را انتخاب کنید، زمان آزاد را ببینید و نوبت بگیرید.'}
              </p>
              <div className="mt-6 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <Link
                  href={texts.ctaPrimaryLink || '/search'}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-coral px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-coral-dark"
                >
                  {texts.ctaPrimaryText || 'شروع جستجو'}
                </Link>
                <Link
                  href={texts.ctaSecondaryLink || '/register'}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/30 bg-transparent px-6 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  {texts.ctaSecondaryText || 'ثبت‌نام رایگان'}
                </Link>
              </div>
            </div>
          </section>
        );
      default:
        return null;
    }
  }

  const ids =
    ordered.length > 0 ? ordered : (['hero', 'categories', 'featured', 'cta'] as const);

  return <div>{ids.map((id) => renderSection(id))}</div>;
}
