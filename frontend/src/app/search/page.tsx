import Link from 'next/link';
import type { Metadata } from 'next';
import { listFilterCategories, searchProfessionals, PublicApiError } from '@/lib/public-api';
import { ProfessionalCard } from '@/components/professionals/professional-card';
import { EmptyState } from '@/components/professionals/empty-state';
import { ApiErrorState } from '@/components/professionals/api-error';
import { siteName } from '@/lib/seo';
import { NearMeFields } from '@/components/search/near-me-fields';

export const metadata: Metadata = {
  title: 'جستجو',
  description: `جستجوی زیباگر و خدمات زیبایی در ${siteName()}`,
};

type Props = {
  searchParams: Promise<{
    q?: string; city?: string; category?: string; page?: string;
    minRating?: string; minPrice?: string; maxPrice?: string;
    sort?: string; availableDate?: string;
    lat?: string; lng?: string; radiusKm?: string;
  }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const city = sp.city?.trim() || undefined;
  const category = sp.category?.trim() || undefined;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const minRating = sp.minRating != null && sp.minRating !== '' ? parseFloat(sp.minRating) : undefined;
  const minPrice = sp.minPrice != null && sp.minPrice !== '' ? parseInt(sp.minPrice, 10) : undefined;
  const maxPrice = sp.maxPrice != null && sp.maxPrice !== '' ? parseInt(sp.maxPrice, 10) : undefined;
  const sort = sp.sort?.trim() || 'featured';
  const availableDate = sp.availableDate?.trim() || undefined;
  const lat = sp.lat?.trim() || undefined;
  const lng = sp.lng?.trim() || undefined;
  const radiusKm = sp.radiusKm?.trim() || undefined;

  let categories: Awaited<ReturnType<typeof listFilterCategories>> = [];
  let result: Awaited<ReturnType<typeof searchProfessionals>> | null = null;
  let errorMsg: string | null = null;

  try { categories = await listFilterCategories(); } catch { /* optional */ }
  try {
    result = await searchProfessionals({
      q, city, category, filterCategory: true, page, limit: 12,
      minRating: Number.isFinite(minRating as number) ? minRating : undefined,
      minPrice: Number.isFinite(minPrice as number) ? minPrice : undefined,
      maxPrice: Number.isFinite(maxPrice as number) ? maxPrice : undefined,
      sort, availableDate, lat, lng, radiusKm,
    });
  } catch (e) {
    errorMsg = e instanceof PublicApiError ? e.message : 'خطا در دریافت نتایج جستجو';
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.meta.total / result.meta.limit)) : 1;

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (city) params.set('city', city);
    if (category) params.set('category', category);
    if (minRating != null && Number.isFinite(minRating)) params.set('minRating', String(minRating));
    if (minPrice != null && Number.isFinite(minPrice)) params.set('minPrice', String(minPrice));
    if (maxPrice != null && Number.isFinite(maxPrice)) params.set('maxPrice', String(maxPrice));
    if (sort && sort !== 'featured') params.set('sort', sort);
    if (availableDate) params.set('availableDate', availableDate);
    if (lat) params.set('lat', lat);
    if (lng) params.set('lng', lng);
    if (radiusKm) params.set('radiusKm', radiusKm);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/search${qs ? `?${qs}` : ''}`;
  }

  const inputCls = 'h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-blue">جستجو</h1>
      <p className="mt-1 text-sm text-gray">فیلتر بر اساس متن، شهر، فاصله، دسته، امتیاز، قیمت و تاریخ در دسترس بودن</p>

      <form method="get" action="/search" className="mt-6 space-y-4 rounded-3xl border border-border/90 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">عبارت</label>
            <input name="q" defaultValue={q || ''} placeholder="نام یا تخصص" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">شهر</label>
            <input name="city" defaultValue={city || ''} placeholder="شهر" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">دسته‌بندی</label>
            <select name="category" defaultValue={category || ''} className={inputCls}>
              <option value="">همه</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">مرتب‌سازی</label>
            <select name="sort" defaultValue={sort} className={inputCls}>
              <option value="featured">پیشنهادی</option>
              <option value="distance">نزدیک‌ترین</option>
              <option value="rating">بیشترین امتیاز</option>
              <option value="reviews">بیشترین نظر</option>
              <option value="newest">جدیدترین</option>
              <option value="price_asc">ارزان‌ترین (در صفحه)</option>
              <option value="price_desc">گران‌ترین (در صفحه)</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">حداقل امتیاز</label>
            <select name="minRating" defaultValue={minRating != null && Number.isFinite(minRating) ? String(minRating) : ''} className={inputCls}>
              <option value="">همه</option>
              <option value="4.5">۴٫۵+</option>
              <option value="4">۴+</option>
              <option value="3">۳+</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">حداقل قیمت (ریال)</label>
            <input name="minPrice" type="number" min={0} step={1000}
              defaultValue={minPrice != null && Number.isFinite(minPrice) ? String(minPrice) : ''}
              placeholder="مثلاً ۲۰۰۰۰۰" dir="ltr" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">حداکثر قیمت (ریال)</label>
            <input name="maxPrice" type="number" min={0} step={1000}
              defaultValue={maxPrice != null && Number.isFinite(maxPrice) ? String(maxPrice) : ''}
              placeholder="مثلاً ۲۰۰۰۰۰۰" dir="ltr" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">تاریخ در دسترس بودن</label>
            <input name="availableDate" type="date" defaultValue={availableDate || ''} dir="ltr" className={inputCls} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <NearMeFields defaultLat={lat} defaultLng={lng} defaultRadiusKm={radiusKm || '15'} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="h-11 rounded-2xl bg-coral px-6 text-sm font-medium text-white transition-colors hover:bg-coral-dark">
            اعمال فیلتر
          </button>
          <Link href="/search" className="inline-flex h-11 items-center rounded-2xl border border-border px-4 text-sm hover:bg-gray-light">
            پاک کردن
          </Link>
        </div>
      </form>

      <div className="mt-8">
        {errorMsg && <ApiErrorState message={errorMsg} />}
        {!errorMsg && result && result.items.length === 0 && <EmptyState title="نتیجه‌ای یافت نشد" />}
        {!errorMsg && result && result.items.length > 0 && (
          <>
            <p className="mb-4 text-sm text-gray">{result.meta.total.toLocaleString('fa-IR')} زیباگر</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((pro) => (
                <ProfessionalCard key={pro.id} pro={pro} />
              ))}
            </div>
            {totalPages > 1 && (
              <nav className="mt-8 flex flex-wrap items-center justify-center gap-2">
                {page > 1 && (
                  <Link href={pageHref(page - 1)} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-gray-light">قبلی</Link>
                )}
                <span className="text-sm text-gray">
                  صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
                </span>
                {page < totalPages && (
                  <Link href={pageHref(page + 1)} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-gray-light">بعدی</Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
