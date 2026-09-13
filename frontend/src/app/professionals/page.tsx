import Link from 'next/link';
import type { Metadata } from 'next';
import { searchProfessionals, PublicApiError } from '@/lib/public-api';
import { ProfessionalCard } from '@/components/professionals/professional-card';
import { EmptyState } from '@/components/professionals/empty-state';
import { ApiErrorState } from '@/components/professionals/api-error';
import { siteName } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'زیباگران',
  description: `فهرست زیباگران تأییدشده در ${siteName()}`,
};

type Props = {
  searchParams: Promise<{ page?: string; city?: string; category?: string }>;
};

export default async function ProfessionalsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
  const city = sp.city?.trim() || undefined;
  const category = sp.category?.trim() || undefined;

  let result: Awaited<ReturnType<typeof searchProfessionals>> | null = null;
  let errorMsg: string | null = null;

  try {
    result = await searchProfessionals({ page, limit: 12, city, category });
  } catch (e) {
    errorMsg =
      e instanceof PublicApiError ? e.message : 'خطا در بارگذاری زیباگران';
  }

  const totalPages = result
    ? Math.max(1, Math.ceil(result.meta.total / result.meta.limit))
    : 1;

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (category) params.set('category', category);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/professionals${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue">زیباگران</h1>
          <p className="mt-1 text-sm text-gray">
            پروفایل‌های تأییدشده — مرتب‌سازی بر اساس ویژه و امتیاز
          </p>
        </div>
        <Link
          href="/search"
          className="text-sm font-medium text-coral hover:text-coral-dark"
        >
          جستجوی پیشرفته
        </Link>
      </div>

      <div className="mt-8">
        {errorMsg && <ApiErrorState message={errorMsg} />}
        {!errorMsg && result && result.items.length === 0 && (
          <EmptyState title="زیباگری یافت نشد" />
        )}
        {!errorMsg && result && result.items.length > 0 && (
          <>
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
