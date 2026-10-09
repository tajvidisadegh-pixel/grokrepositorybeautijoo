import Link from 'next/link';
import { Suspense } from 'react';
import { PersistSearchFilters } from '@/components/search/persist-search-filters';
import type { Metadata } from 'next';
import { listFilterCategories, searchProfessionals, PublicApiError } from '@/lib/public-api';
import { ProfessionalCard } from '@/components/professionals/professional-card';
import { EmptyState } from '@/components/professionals/empty-state';
import { ApiErrorState } from '@/components/professionals/api-error';
import { siteName } from '@/lib/seo';
import { NearMeFields } from '@/components/search/near-me-fields';
import { RecentSearches, RecordRecentSearch } from '@/components/search/recent-searches';
import { FormJalaliDate } from '@/components/ui/jalali-date-input';
import { tehranTodayIso } from '@/lib/jalali';

export const metadata: Metadata = {
  title: 'جستجو',
  description: `جستجوی زیباگر و خدمات زیبایی در ${siteName()}`,
};

type Props = {
  searchParams: Promise<{
    q?: string; city?: string; category?: string; page?: string;
    minRating?: string; minPrice?: string; maxPrice?: string;
    sort?: string; availableDate?: string; availableToday?: string;
    lat?: string; lng?: string;
    verifiedOnly?: string; gender?: string; minDuration?: string; maxDuration?: string; durationBand?: string;
  }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const city = sp.city?.trim() || undefined;
  const category = sp.category?.trim() || undefined;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const minRating = sp.minRating != null && sp.minRating !== '' ? parseFloat(sp.minRating) : undefined;
  const durationBand = (sp.durationBand || '').trim();
  let minDuration: number | undefined;
  let maxDuration: number | undefined;
  if (durationBand === 'under60') { minDuration = 1; maxDuration = 60; }
  else if (durationBand === '60to120') { minDuration = 61; maxDuration = 120; }
  else if (durationBand === 'over120') { minDuration = 121; }
  else {
    if (sp.minDuration != null && sp.minDuration !== '') minDuration = parseInt(sp.minDuration, 10);
    if (sp.maxDuration != null && sp.maxDuration !== '') maxDuration = parseInt(sp.maxDuration, 10);
  }
  const minPrice = sp.minPrice != null && sp.minPrice !== '' ? parseInt(sp.minPrice, 10) : undefined;
  const maxPrice = sp.maxPrice != null && sp.maxPrice !== '' ? parseInt(sp.maxPrice, 10) : undefined;
  const sort = sp.sort?.trim() || 'featured';
  const availableToday = sp.availableToday === '1' || sp.availableToday === 'true';
  const availableDate = availableToday ? tehranTodayIso() : (sp.availableDate?.trim() || undefined);
  const lat = sp.lat?.trim() || undefined;
  const lng = sp.lng?.trim() || undefined;
  // Near-me uses a fixed technical maximum; the customer no longer chooses a radius.
  const radiusKm = lat && lng ? '200' : undefined;
  const verifiedOnly = sp.verifiedOnly === '1' || sp.verifiedOnly === 'true';
  const gender = sp.gender?.trim() || undefined;

  let categories: Awaited<ReturnType<typeof listFilterCategories>> = [];
  let result: Awaited<ReturnType<typeof searchProfessionals>> | null = null;
  let errorMsg: string | null = null;

  try { categories = await listFilterCategories(); } catch { /* optional */ }
  try {
    result = await searchProfessionals({
      q, city, category, filterCategory: true, page, limit: 12,
      minRating: Number.isFinite(minRating as number) ? minRating : undefined,
      minPrice: Number.isFinite(minPrice as number) ? minPrice : undefined,
      minDuration: minDuration != null && Number.isFinite(minDuration) ? minDuration : undefined,
      maxDuration: maxDuration != null && Number.isFinite(maxDuration) ? maxDuration : undefined,
      maxPrice: Number.isFinite(maxPrice as number) ? maxPrice : undefined,
      sort, availableDate, lat, lng, radiusKm,
      verifiedOnly: verifiedOnly || undefined,
      gender,
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
    if (minDuration != null && Number.isFinite(minDuration)) params.set('minDuration', String(minDuration));
    if (maxDuration != null && Number.isFinite(maxDuration)) params.set('maxDuration', String(maxDuration));
    if (durationBand) params.set('durationBand', durationBand);
    if (minPrice != null && Number.isFinite(minPrice)) params.set('minPrice', String(minPrice));
    if (maxPrice != null && Number.isFinite(maxPrice)) params.set('maxPrice', String(maxPrice));
    if (sort && sort !== 'featured') params.set('sort', sort);
    if (availableDate) params.set('availableDate', availableDate);
    if (availableToday) params.set('availableToday', '1');
    if (minDuration != null && Number.isFinite(minDuration)) params.set('minDuration', String(minDuration));
    if (lat) params.set('lat', lat);
    if (lng) params.set('lng', lng);
    if (lat && lng) params.set('radiusKm', '200');
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/search${qs ? `?${qs}` : ''}`;
  }

  const inputCls = 'h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-blue">جستجو</h1>
      <p className="mt-1 text-sm text-gray">فیلتر بر اساس متن، شهر، فاصله، دسته، امتیاز، قیمت و تاریخ در دسترس بودن</p>

      <RecentSearches />
      <Suspense fallback={null}><PersistSearchFilters /></Suspense>
      {(q || city) && (
        <RecordRecentSearch q={q} city={city} href={pageHref(1)} />
      )}

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
            <label className="mb-1 block text-xs font-medium text-gray">حداقل قیمت (تومان)</label>
            <input name="minPrice" type="number" min={0} step={1000}
              defaultValue={minPrice != null && Number.isFinite(minPrice) ? String(minPrice) : ''}
              placeholder="مثلاً ۲۰۰۰۰۰" dir="ltr" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray">حداکثر قیمت (تومان)</label>
            <input name="maxPrice" type="number" min={0} step={1000}
              defaultValue={maxPrice != null && Number.isFinite(maxPrice) ? String(maxPrice) : ''}
              placeholder="مثلاً ۲۰۰۰۰۰۰" dir="ltr" className={inputCls} />
          </div>
                    <div>
            <label className="mb-1 block text-xs font-medium text-gray">مدت خدمت</label>
            <select name="durationBand" defaultValue={durationBand || ""} className={inputCls}>
              <option value="">همه مدت‌ها</option>
              <option value="under60">زیر ۶۰ دقیقه</option>
              <option value="60to120">۶۰ تا ۱۲۰ دقیقه</option>
              <option value="over120">بیش از ۲ ساعت</option>
            </select>
          </div>
<div>
            <label className="mb-1 block text-xs font-medium text-gray">تاریخ در دسترس بودن</label>
            <FormJalaliDate name="availableDate" defaultValue={availableDate || ''} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray">جنسیت زیباگر</label>
            <select name="gender" defaultValue={gender || ''} className={inputCls}>
              <option value="">همه</option>
              <option value="female">زن</option>
              <option value="male">مرد</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-2xl border border-border px-3 text-sm">
              <input
                type="checkbox"
                name="verifiedOnly"
                value="true"
                defaultChecked={verifiedOnly}
                className="size-4 accent-coral"
              />
              فقط تأییدشده‌ها
            </label>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <NearMeFields defaultLat={lat} defaultLng={lng} />
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

      {sort === 'distance' && !(lat && lng) && (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          برای مرتب‌سازی «نزدیک‌ترین»، دکمه نزدیک من را بزنید تا موقعیت شما دریافت شود.
        </p>
      )}

      <div className="mt-8">
        {errorMsg && <ApiErrorState message={errorMsg} />}
        {!errorMsg && result && result.items.length === 0 && (
          <EmptyState
            title={lat && lng ? 'زیباگری در محدوده انتخاب‌شده پیدا نشد' : 'نتیجه‌ای یافت نشد'}
            description={
              lat && lng
                ? 'شعاع را بزرگ‌تر کنید یا فیلترها را کم کنید.'
                : 'عبارت یا فیلتر دیگری امتحان کنید، یا همه زیباگران را ببینید.'
            }
            action={
              <Link
                href="/professionals"
                className="inline-flex rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
              >
                مشاهده همه زیباگران
              </Link>
            }
          />
        )}
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
