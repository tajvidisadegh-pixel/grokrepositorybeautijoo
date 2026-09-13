import Link from 'next/link';
import type { Metadata } from 'next';
import { listFilterCategories, searchProfessionals, PublicApiError } from '@/lib/public-api';
import { ProfessionalCard } from '@/components/professionals/professional-card';
import { EmptyState } from '@/components/professionals/empty-state';
import { ApiErrorState } from '@/components/professionals/api-error';
import { siteName } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'جستجو',
  description: `جستجوی زیباگر و خدمات زیبایی در ${siteName()}`,
};

type Props = {
  searchParams: Promise<{ q?: string; city?: string; category?: string; page?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const city = sp.city?.trim() || undefined;
  const category = sp.category?.trim() || undefined;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  let categories: Awaited<ReturnType<typeof listFilterCategories>> = [];
  let result: Awaited<ReturnType<typeof searchProfessionals>> | null = null;
  let errorMsg: string | null = null;

  try {
    categories = await listFilterCategories();
  } catch {
    /* optional */
  }
  try {
    result = await searchProfessionals({
      q,
      city,
      category,
      filterCategory: true,
      page,
      limit: 12,
    });
  } catch (e) {
    errorMsg = e instanceof PublicApiError ? e.message : 'خطا در دریافت نتایج جستجو';
  }

  const totalPages = result
    ? Math.max(1, Math.ceil(result.meta.total / result.meta.limit))
    : 1;

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (city) params.set('city', city);
    if (category) params.set('category', category);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/search${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-blue">جستجو</h1>
      <p className="mt-1 text-sm text-gray">
        فیلتر بر اساس متن، شهر و دسته‌بندی‌های تأییدشده سایت
      </p>

      <form
        method="get"
        action="/search"
        className="mt-6 grid gap-3 rounded-3xl border border-border/90 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray">عبارت</label>
          <input
            name="q"
            defaultValue={q || ''}
            placeholder="نام یا تخصص"
            className="h-11 w-full rounded-2xl border border-border px-3 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray">شهر</label>
          <input
            name="city"
            defaultValue={city || ''}
            placeholder="شهر"
            className="h-11 w-full rounded-2xl border border-border px-3 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray">دسته‌بندی</label>
          <select
            name="category"
            defaultValue={category || ''}
            className="h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
          >
            <option value="">همه</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="h-11 w-full rounded-2xl bg-coral text-sm font-medium text-white transition-colors hover:bg-coral-dark"
          >
            اعمال فیلتر
          </button>
        </div>
      </form>

      <div className="mt-8">
        {errorMsg && <ApiErrorState message={errorMsg} />}
        {!errorMsg && result && result.items.length === 0 && (
          <EmptyState title="نتیجه‌ای یافت نشد" />
        )}
        {!errorMsg && result && result.items.length > 0 && (
          <>
            <p className="mb-4 text-sm text-gray">
              {result.meta.total.toLocaleString('fa-IR')} زیباگر
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((pro) => (
                <ProfessionalCard key={pro.id} pro={pro} />
              ))}
            </div>
            {totalPages > 1 && (
              <nav className="mt-8 flex flex-wrap items-center justify-center gap-2">
                {page > 1 && (
                  <Link
                    href={pageHref(page - 1)}
                    className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-gray-light"
                  >
                    قبلی
                  </Link>
                )}
                <span className="text-sm text-gray">
                  صفحه {page.toLocaleString('fa-IR')} از{' '}
                  {totalPages.toLocaleString('fa-IR')}
                </span>
                {page < totalPages && (
                  <Link
                    href={pageHref(page + 1)}
                    className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-gray-light"
                  >
                    بعدی
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
