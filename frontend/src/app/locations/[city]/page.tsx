import Link from 'next/link';
import type { Metadata } from 'next';
import { searchProfessionals, PublicApiError } from '@/lib/public-api';
import { ProfessionalCard } from '@/components/professionals/professional-card';
import { EmptyState } from '@/components/professionals/empty-state';
import { ApiErrorState } from '@/components/professionals/api-error';
import { absoluteUrl, siteName } from '@/lib/seo';

type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: raw } = await params;
  const city = decodeURIComponent(raw);
  const title = `زیباگران در ${city}`;
  const description = `رزرو آنلاین خدمات زیبایی با زیباگران ${city} در ${siteName()}`;
  const url = absoluteUrl(`/locations/${encodeURIComponent(city)}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, locale: 'fa_IR' },
  };
}

/**
 * Public city pages use GET /professionals?city=...
 * There is no dedicated public cities catalog endpoint.
 */
export default async function LocationPage({ params, searchParams }: Props) {
  const { city: raw } = await params;
  const city = decodeURIComponent(raw);
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);

  let result: Awaited<ReturnType<typeof searchProfessionals>> | null = null;
  let errorMsg: string | null = null;

  try {
    result = await searchProfessionals({ city, page, limit: 12 });
  } catch (e) {
    errorMsg =
      e instanceof PublicApiError
        ? e.message
        : 'خطا در بارگذاری زیباگران این شهر';
  }

  const totalPages = result
    ? Math.max(1, Math.ceil(result.meta.total / result.meta.limit))
    : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-6 text-sm text-gray">
        <Link href="/professionals" className="hover:text-coral">
          زیباگران
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{city}</span>
      </nav>

      <h1 className="text-2xl font-bold">زیباگران در {city}</h1>
      <p className="mt-1 text-sm text-gray">
        بر اساس فیلتر شهر در API عمومی professionals
      </p>

      <div className="mt-8">
        {errorMsg && <ApiErrorState message={errorMsg} />}
        {!errorMsg && result && result.items.length === 0 && (
          <EmptyState
            title={`زیباگری در «${city}» یافت نشد`}
            description="شهر دیگری را امتحان کنید یا همه زیباگران را ببینید."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link
                  href="/professionals"
                  className="inline-flex rounded-xl bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
                >
                  مشاهده همه زیباگران
                </Link>
                <Link
                  href="/search"
                  className="inline-flex rounded-xl border border-border px-4 py-2 text-sm hover:bg-gray-light"
                >
                  جستجو
                </Link>
              </div>
            }
          />
        )}
        {!errorMsg && result && result.items.length > 0 && (
          <>
            <p className="mb-4 text-sm text-gray">
              {result.meta.total.toLocaleString('fa-IR')} نتیجه
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((pro) => (
                <ProfessionalCard key={pro.id} pro={pro} />
              ))}
            </div>
            {totalPages > 1 && (
              <nav className="mt-8 flex justify-center gap-2 text-sm">
                {page > 1 && (
                  <Link
                    href={`/locations/${encodeURIComponent(city)}?page=${page - 1}`}
                    className="rounded-xl border border-border px-4 py-2 hover:bg-gray-light"
                  >
                    قبلی
                  </Link>
                )}
                <span className="py-2 text-gray">
                  {page} / {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/locations/${encodeURIComponent(city)}?page=${page + 1}`}
                    className="rounded-xl border border-border px-4 py-2 hover:bg-gray-light"
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
