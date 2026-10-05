import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  listCategories,
  searchProfessionals,
  PublicApiError,
} from '@/lib/public-api';
import { ProfessionalCard } from '@/components/professionals/professional-card';
import { EmptyState } from '@/components/professionals/empty-state';
import { absoluteUrl, siteName } from '@/lib/seo';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const cats = await listCategories();
    const cat = cats.find((c) => c.slug === slug);
    if (!cat) return { title: 'دسته یافت نشد' };
    const title = `${cat.name} — خدمات زیبایی`;
    const description =
      cat.description?.slice(0, 160) ||
      `زیباگران و خدمات ${cat.name} در ${siteName()}`;
    const url = absoluteUrl(`/categories/${cat.slug}`);
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: { title, description, url, locale: 'fa_IR' },
    };
  } catch {
    return { title: 'دسته‌بندی' };
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  let cat;
  try {
    const cats = await listCategories();
    cat = cats.find((c) => c.slug === slug);
  } catch (e) {
    if (e instanceof PublicApiError) throw e;
    notFound();
  }
  if (!cat) notFound();

  let pros: Awaited<ReturnType<typeof searchProfessionals>> | null = null;
  try {
    pros = await searchProfessionals({ category: slug, page: 1, limit: 12 });
  } catch {
    pros = null;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-6 text-sm text-gray">
        <Link href="/services" className="hover:text-coral">
          خدمات
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{cat.name}</span>
      </nav>

      <h1 className="text-2xl font-bold">{cat.name}</h1>
      {cat.description && (
        <p className="mt-2 text-sm text-gray">{cat.description}</p>
      )}

      {cat.services && cat.services.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">خدمات این دسته</h2>
          <ul className="flex flex-wrap gap-2">
            {cat.services.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/search?category=${encodeURIComponent(slug)}`}
                  className="inline-block rounded-full bg-coral-soft px-3 py-1 text-sm text-foreground hover:bg-coral-light"
                >
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-bold">زیباگران این دسته</h2>
          <Link
            href={`/search?category=${encodeURIComponent(slug)}`}
            className="text-sm text-coral hover:underline"
          >
            جستجو
          </Link>
        </div>
        {!pros && (
          <p className="text-sm text-gray">بارگذاری زیباگران ممکن نشد.</p>
        )}
        {pros && pros.items.length === 0 && (
          <EmptyState
            title="زیباگری در این دسته نیست"
            description="فعلاً پروفایل تأییدشده‌ای در این دسته ثبت نشده. می‌توانید همه زیباگران را ببینید یا جستجو کنید."
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
        {pros && pros.items.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pros.items.map((pro) => (
              <ProfessionalCard key={pro.id} pro={pro} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
