import Link from 'next/link';
import { Search, Scissors, Sparkles, Hand, Eye, Smile, Heart } from 'lucide-react';
import type { Metadata } from 'next';
import {
  listCategories,
  searchProfessionals,
} from '@/lib/public-api';
import { ProfessionalCard } from '@/components/professionals/professional-card';
import { siteName } from '@/lib/seo';

export const metadata: Metadata = {
  title: { absolute: `${siteName()} | رزرو آنلاین خدمات زیبایی` },
  description:
    'بیوتی‌جو — رزرو آنلاین نوبت زیبایی، آسان و سریع. زیباگر مناسب خود را پیدا کنید.',
};

const CATEGORY_ICONS = [Scissors, Sparkles, Hand, Eye, Smile, Heart, Scissors, Sparkles];

export default async function HomePage() {
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  let featured: Awaited<ReturnType<typeof searchProfessionals>> | null = null;
  let loadError = false;

  try {
    const [cats, pros] = await Promise.all([
      listCategories(),
      searchProfessionals({ page: 1, limit: 6 }),
    ]);
    categories = cats;
    featured = pros;
  } catch {
    loadError = true;
  }

  return (
    <div>
      {/* Hero — matches mockup messaging */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-soft via-white to-coral-soft/30">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-blue/5 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold tracking-wide text-coral sm:text-sm">
              بیوتی‌جو · رزرو آنلاین نوبت
            </p>
            <h1 className="text-2xl font-bold leading-snug text-blue sm:text-3xl sm:leading-tight md:text-4xl lg:text-5xl">
              بیوتی‌جو، رزرو آنلاین نوبت
              <span className="block text-foreground">آسان و سریع</span>
            </h1>
            <p className="mt-3 text-sm leading-7 text-gray sm:mt-4 sm:text-base md:text-lg">
              زیباگر مناسب خود را پیدا کنید — آرایش، ناخن، پوست و بیشتر، نزدیک شما
            </p>
            <form
              action="/search"
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
                جستجو
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Popular categories — icon style like mockup */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
          <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
            <h2 className="text-lg font-bold text-foreground sm:text-xl">دسته‌بندی‌های محبوب</h2>
            <Link
              href="/services"
              className="text-sm font-medium text-coral transition-colors hover:text-coral-dark"
            >
              همه خدمات
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
      )}

      {/* Top professionals / salons of the week */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
        <div className="mb-5 flex items-end justify-between gap-4 sm:mb-6">
          <h2 className="text-lg font-bold text-foreground sm:text-xl">سالن‌های برتر هفته</h2>
          <Link
            href="/professionals"
            className="text-sm font-medium text-coral transition-colors hover:text-coral-dark"
          >
            مشاهده همه
          </Link>
        </div>
        {loadError && (
          <p className="rounded-2xl bg-gray-light px-4 py-6 text-center text-sm text-gray">
            در حال حاضر امکان بارگذاری لیست زیباگران نیست. بعداً تلاش کنید.
          </p>
        )}
        {!loadError && featured && featured.items.length === 0 && (
          <p className="text-center text-sm text-gray">
            هنوز زیباگر تأییدشده‌ای ثبت نشده است.
          </p>
        )}
        {featured && featured.items.length > 0 && (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.items.map((pro) => (
              <ProfessionalCard key={pro.id} pro={pro} />
            ))}
          </div>
        )}
      </section>

      {/* Bottom CTA — navy band style */}
      <section className="bg-blue">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:py-14">
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            آماده رزرو هستید؟
          </h2>
          <p className="mt-2 text-sm text-white/80 sm:text-base">
            زیباگر را انتخاب کنید، زمان آزاد را ببینید و نوبت بگیرید.
          </p>
          <div className="mt-6 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <Link
              href="/search"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-coral px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-coral-dark"
            >
              شروع جستجو
            </Link>
            <Link
              href="/register"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/30 bg-transparent px-6 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              ثبت‌نام رایگان
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
