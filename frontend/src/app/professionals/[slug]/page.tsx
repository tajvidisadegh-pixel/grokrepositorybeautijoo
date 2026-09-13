import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getProfessionalBySlug,
  PublicApiError,
} from '@/lib/public-api';
import { absoluteUrl, professionalJsonLd, siteName } from '@/lib/seo';
import { ServiceOfferCard } from '@/components/professionals/service-offer-card';
import { ServicePortfolioGallery } from '@/components/professionals/service-portfolio-gallery';
import type { ProfessionalServiceItem } from '@/types/public';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const pro = await getProfessionalBySlug(slug);
    const name = pro.user?.profile?.displayName || pro.title;
    const city = pro.locations?.[0]?.location?.city;
    const title = city ? `${name} — زیباگر در ${city}` : `${name} — زیباگر`;
    const description =
      pro.bio?.slice(0, 160) ||
      `${name} در ${siteName()} — مشاهده خدمات، قیمت و رزرو آنلاین`;
    const url = absoluteUrl(`/professionals/${pro.slug}`);
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        title,
        description,
        url,
        type: 'profile',
        locale: 'fa_IR',
        images: pro.user?.profile?.avatarUrl
          ? [{ url: pro.user.profile.avatarUrl }]
          : undefined,
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
    };
  } catch {
    return { title: 'زیباگر یافت نشد' };
  }
}

const DAY_FA: Record<string, string> = {
  sunday: 'یکشنبه',
  monday: 'دوشنبه',
  tuesday: 'سه‌شنبه',
  wednesday: 'چهارشنبه',
  thursday: 'پنجشنبه',
  friday: 'جمعه',
  saturday: 'شنبه',
  SUNDAY: 'یکشنبه',
  MONDAY: 'دوشنبه',
  TUESDAY: 'سه‌شنبه',
  WEDNESDAY: 'چهارشنبه',
  THURSDAY: 'پنجشنبه',
  FRIDAY: 'جمعه',
  SATURDAY: 'شنبه',
};

export default async function ProfessionalProfilePage({ params }: Props) {
  const { slug } = await params;
  let pro;
  try {
    pro = await getProfessionalBySlug(slug);
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    throw e;
  }

  const name = pro.user?.profile?.displayName || pro.title;
  const avatar = pro.user?.profile?.avatarUrl;
  const rating =
    pro.ratingAvg != null ? Number(pro.ratingAvg).toFixed(1) : null;
  const jsonLd = professionalJsonLd(pro);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-6 text-sm text-gray">
        <Link href="/professionals" className="hover:text-coral">
          زیباگران
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <header className="flex flex-col gap-4 overflow-hidden rounded-3xl border border-border/90 bg-white shadow-[0_1px_3px_rgba(31,41,55,0.05)] sm:flex-row sm:items-start">
            <div className="flex w-full items-center gap-4 bg-gradient-to-l from-coral-soft/80 to-white p-6 sm:flex-1">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-coral-soft text-2xl font-bold text-coral ring-2 ring-coral/20 sm:size-24">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt={name} className="size-full object-cover" />
                ) : (
                  name.charAt(0)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-blue sm:text-2xl">{name}</h1>
                {pro.title && pro.title !== name && (
                  <p className="mt-1 text-sm text-gray">{pro.title}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray">
                  {rating && (pro.ratingCount ?? 0) > 0 && (
                    <span className="text-amber-500">
                      ★ {rating}{' '}
                      <span className="text-gray">({pro.ratingCount} نظر)</span>
                    </span>
                  )}
                  {pro.locations?.[0]?.location?.city && (
                    <span>{pro.locations[0].location.city}</span>
                  )}
                </div>
              </div>
            </div>
          </header>

          {pro.bio && (
            <section className="rounded-3xl border border-border/90 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-foreground">درباره زیباگر</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray">
                {pro.bio}
              </p>
            </section>
          )}

          <ServicePortfolioGallery
            slug={pro.slug}
            services={(pro.professionalServices || []) as ProfessionalServiceItem[]}
          />

          <section className="rounded-3xl border border-border/90 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground">خدمات و قیمت</h2>
            {(!pro.professionalServices ||
              pro.professionalServices.length === 0) && (
              <p className="mt-3 text-sm text-gray">خدمتی ثبت نشده است.</p>
            )}
            <ul className="mt-4 space-y-3">
              {pro.professionalServices?.map((ps) => (
                <ServiceOfferCard
                  key={ps.id}
                  ps={ps as ProfessionalServiceItem}
                  slug={pro.slug}
                />
              ))}
            </ul>
          </section>

          {pro.reviews && pro.reviews.length > 0 && (
            <section className="rounded-3xl border border-border/90 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-foreground">نظرات</h2>
              <ul className="mt-4 space-y-4">
                {pro.reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl bg-gray-light/60 p-4">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">
                        {r.customer?.profile?.displayName || 'کاربر'}
                      </span>
                      <span className="text-amber-500">★ {r.rating}</span>
                    </div>
                    {r.comment && (
                      <p className="mt-2 text-sm text-gray">{r.comment}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-border/90 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-foreground">رزرو نوبت</h2>
            <p className="mt-2 text-sm text-gray">
              برای انتخاب زمان و ثبت نوبت وارد جریان رزرو شوید.
            </p>
            <Link
              href={`/booking/${pro.slug}`}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-2xl bg-coral text-sm font-medium text-white shadow-sm transition-colors hover:bg-coral-dark"
            >
              رزرو نوبت
            </Link>
            <p className="mt-2 text-xs text-gray-muted">
              انتخاب خدمت، تاریخ و ساعت آزاد از سرور
            </p>
          </div>

          {pro.locations && pro.locations.length > 0 && (
            <div className="rounded-3xl border border-border/90 bg-white p-6 shadow-sm">
              <h2 className="font-bold text-foreground">مکان‌ها</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {pro.locations.map((pl) => (
                  <li key={pl.location.id}>
                    <p className="font-medium">{pl.location.name}</p>
                    <p className="text-gray">
                      {pl.location.city}
                      {pl.location.province ? `، ${pl.location.province}` : ''}
                    </p>
                    <p className="text-xs text-gray-muted">{pl.location.address}</p>
                    <Link
                      href={`/locations/${encodeURIComponent(pl.location.city)}`}
                      className="mt-1 inline-block text-xs text-coral hover:text-coral-dark"
                    >
                      زیباگران در {pl.location.city}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {pro.workingHours && pro.workingHours.length > 0 && (
        <section className="mt-8 rounded-3xl border border-border/90 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-foreground">ساعات کاری هفتگی</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pro.workingHours.map((wh) => (
              <li
                key={wh.id}
                className="flex justify-between gap-2 rounded-2xl bg-gray-light/60 px-4 py-3 text-sm text-gray"
              >
                <span>{DAY_FA[wh.dayOfWeek] || wh.dayOfWeek}</span>
                <span dir="ltr">
                  {wh.startTime} – {wh.endTime}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
