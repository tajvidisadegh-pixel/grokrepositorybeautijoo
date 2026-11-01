import { ScrollToTop } from '@/components/ui/scroll-to-top';
import Link from 'next/link';
import { Suspense } from 'react';
import { PersistSearchFilters } from '@/components/search/persist-search-filters';
import { NearMeFields } from '@/components/search/near-me-fields';
import { RecordRecentSearch, RecentSearches } from '@/components/search/recent-searches';
import { EmptyState, ApiErrorState } from '@/components/panel/state-blocks';
import { ProfessionalCard } from '@/components/professionals/professional-card';
import { FormJalaliDate } from '@/components/ui/jalali-date-input';
import { fetchCategories, searchProfessionals } from '@/lib/public-api';

export const dynamic = 'force-dynamic';

type SearchParams = {
  q?: string;
  city?: string;
  category?: string;
  page?: string;
  minRating?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  availableDate?: string;
  availableToday?: string;
  availableTomorrow?: string;
  lat?: string;
  lng?: string;
  radiusKm?: string;
  verifiedOnly?: string;
  gender?: string;
  minDuration?: string;
  maxDuration?: string;
  durationBand?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
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
  const availableToday = sp.availableToday === '1' || sp.availableToday === 'true';
  const availableTomorrow = sp.availableTomorrow === '1' || sp.availableTomorrow === 'true';
  const lat = sp.lat != null && sp.lat !== '' ? parseFloat(sp.lat) : undefined;
  const lng = sp.lng != null && sp.lng !== '' ? parseFloat(sp.lng) : undefined;
  const radiusKm = sp.radiusKm != null && sp.radiusKm !== '' ? parseFloat(sp.radiusKm) : undefined;
  const verifiedOnly = sp.verifiedOnly === '1' || sp.verifiedOnly === 'true';
  const gender = sp.gender?.trim() || undefined;
  const durationBand = sp.durationBand?.trim() || undefined;

  let categories: { id: string; name: string; slug: string }[] = [];
  try {
    categories = await fetchCategories();
  } catch {
    categories = [];
  }

  let result: Awaited<ReturnType<typeof searchProfessionals>> | null = null;
  let errorMsg: string | null = null;
  try {
    result = await searchProfessionals({
      q,
      city,
      category,
      filterCategory: true,
      page,
      limit: 12,
      minRating: Number.isFinite(minRating as number) ? minRating : undefined,
      minPrice: Number.isFinite(minPrice as number) ? minPrice : undefined,
      maxPrice: Number.isFinite(maxPrice as number) ? maxPrice : undefined,
      sort,
      availableDate,
      lat,
      lng,
      radiusKm,
      verifiedOnly: verifiedOnly || undefined,
      gender,
      durationBand: durationBand || undefined,
      availableToday: availableToday || undefined,
      availableTomorrow: availableTomorrow || undefined,
    });
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : 'جستجو الان در دسترس نیست. چند دقیقه دیگر دوباره امتحان کنید.';
  }

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
    if (availableToday) params.set('availableToday', '1');
    if (availableTomorrow) params.set('availableTomorrow', '1');
    if (lat != null && Number.isFinite(lat)) params.set('lat', String(lat));
    if (lng != null && Number.isFinite(lng)) params.set('lng', String(lng));
    if (radiusKm != null && Number.isFinite(radiusKm)) params.set('radiusKm', String(radiusKm));
    if (verifiedOnly) params.set('verifiedOnly', 'true');
    if (gender) params.set('gender', gender);
    if (durationBand) params.set('durationBand', durationBand);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/search${qs ? `?${qs}` : ''}`;
  }

  const inputCls =
    'h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-blue">جستجو</h1>
      <p className="mt-1 text-sm text-gray">نام یا شهر را بنویسید و جستجو کنید</p>

      <RecentSearches />
      <Suspense fallback={null}>
        <ScrollToTop />
        <PersistSearchFilters />
      </Suspense>
      {(q || city) && <RecordRecentSearch q={q} city={city} href={pageHref(1)} />}

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
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
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
              <option value="price_asc">ارزان‌ترین</option>
              <option value="price_desc">گران‌ترین</option>
            </select>
          </div>
        </div>

        <details className="group rounded-2xl border border-border/80 bg-gray-light/40 open:bg-white">
          <summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium text-navy marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              <span>فیلترهای بیشتر</span>
              <span className="text-xs font-normal text-gray group-open:hidden">امتیاز، قیمت، تاریخ…</span>
              <span className="hidden text-xs font-normal text-gray group-open:inline">بستن</span>
            </span>
          </summary>
          <div className="grid gap-3 border-t border-border/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray">از چند ستاره به بالا</label>
              <select
                name="minRating"
                defaultValue={minRating != null && Number.isFinite(minRating) ? String(minRating) : ''}
                className={inputCls}
              >
                <option value="">همه</option>
                <option value="4.5">۴٫۵+</option>
                <option value="4">۴+</option>
                <option value="3">۳+</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray">حداقل قیمت (تومان)</label>
              <input
                name="minPrice"
                inputMode="numeric"
                defaultValue={minPrice != null && Number.isFinite(minPrice) ? String(minPrice) : ''}
                placeholder="مثلاً ۲۰۰۰۰۰"
                dir="ltr"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray">حداکثر قیمت (تومان)</label>
              <input
                name="maxPrice"
                inputMode="numeric"
                defaultValue={maxPrice != null && Number.isFinite(maxPrice) ? String(maxPrice) : ''}
                placeholder="مثلاً ۲۰۰۰۰۰۰"
                dir="ltr"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray">مدت خدمت</label>
              <select name="durationBand" defaultValue={durationBand || ''} className={inputCls}>
                <option value="">همه</option>
                <option value="short">کوتاه</option>
                <option value="medium">متوسط</option>
                <option value="long">بلند</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <div className="mb-2 flex flex-wrap gap-2">
                <Link
                  href={(() => {
                    const p = new URLSearchParams();
                    if (q) p.set('q', q);
                    if (city) p.set('city', city);
                    if (category) p.set('category', category);
                    p.set('availableToday', '1');
                    return `/search?${p.toString()}`;
                  })()}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    availableToday ? 'border-coral bg-coral text-white' : 'border-border bg-white'
                  }`}
                >
                  آزاد امروز
                </Link>
                <Link
                  href={(() => {
                    const p = new URLSearchParams();
                    if (q) p.set('q', q);
                    if (city) p.set('city', city);
                    if (category) p.set('category', category);
                    p.set('availableTomorrow', '1');
                    return `/search?${p.toString()}`;
                  })()}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    availableTomorrow ? 'border-coral bg-coral text-white' : 'border-border bg-white'
                  }`}
                >
                  آزاد فردا
                </Link>
              </div>
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
                فقط زیباگرهای تأییدشده سایت
              </label>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <NearMeFields defaultLat={lat} defaultLng={lng} />
            </div>
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="h-11 rounded-2xl bg-coral px-6 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
          >
            جستجو
          </button>
          <Link
            href="/search"
            className="inline-flex h-11 items-center rounded-2xl border border-border px-4 text-sm hover:bg-gray-light"
          >
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
            <p className="mb-4 text-sm text-gray">
              {result.total.toLocaleString('fa-IR')} نتیجه
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((pro) => (
                <li key={pro.id}>
                  <ProfessionalCard professional={pro} />
                </li>
              ))}
            </ul>
            {result.totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                {page > 1 && (
                  <Link href={pageHref(page - 1)} className="rounded-xl border px-4 py-2 text-sm">
                    قبلی
                  </Link>
                )}
                <span className="px-3 py-2 text-sm text-gray">
                  صفحه {page.toLocaleString('fa-IR')} از {result.totalPages.toLocaleString('fa-IR')}
                </span>
                {page < result.totalPages && (
                  <Link href={pageHref(page + 1)} className="rounded-xl border px-4 py-2 text-sm">
                    بعدی
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
