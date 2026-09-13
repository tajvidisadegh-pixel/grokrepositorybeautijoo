import Link from 'next/link';
import type { Metadata } from 'next';
import { listCategories, listServices, PublicApiError } from '@/lib/public-api';
import { ApiErrorState } from '@/components/professionals/api-error';
import { EmptyState } from '@/components/professionals/empty-state';
import { siteName } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'خدمات',
  description: `فهرست خدمات زیبایی در ${siteName()}`,
};

export default async function ServicesPage() {
  let categories: Awaited<ReturnType<typeof listCategories>> = [];
  let services: Awaited<ReturnType<typeof listServices>> = [];
  let errorMsg: string | null = null;

  try {
    [categories, services] = await Promise.all([
      listCategories(),
      listServices(),
    ]);
  } catch (e) {
    errorMsg =
      e instanceof PublicApiError ? e.message : 'خطا در بارگذاری خدمات';
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-blue">خدمات</h1>
      <p className="mt-1 text-sm text-gray">
        از دسته یا خدمت به جستجوی زیباگر بروید
      </p>

      {errorMsg && (
        <div className="mt-8">
          <ApiErrorState message={errorMsg} />
        </div>
      )}

      {!errorMsg && categories.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-foreground">دسته‌بندی‌ها</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                className="rounded-2xl border border-border/90 bg-white p-4 text-center shadow-sm transition-all hover:border-coral/30 hover:bg-coral-soft/40"
              >
                <span className="font-medium text-foreground">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!errorMsg && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-foreground">همه خدمات</h2>
          {services.length === 0 ? (
            <EmptyState title="خدمتی ثبت نشده" />
          ) : (
            <ul className="divide-y divide-border rounded-3xl border border-border/90 bg-white shadow-sm">
              {services.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-4"
                >
                  <div>
                    <p className="font-medium text-foreground">{s.name}</p>
                    {s.category && (
                      <Link
                        href={`/categories/${s.category.slug}`}
                        className="text-xs text-coral hover:text-coral-dark"
                      >
                        {s.category.name}
                      </Link>
                    )}
                  </div>
                  <Link
                    href={`/search?category=${encodeURIComponent(s.category?.slug || '')}`}
                    className="text-sm font-medium text-coral hover:text-coral-dark"
                  >
                    زیباگران این خدمت
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
