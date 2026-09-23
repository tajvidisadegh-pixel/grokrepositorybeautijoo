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
import type { ProfessionalServiceItem, WorkingHour } from '@/types/public';
import LocationMapView from '@/components/location/location-map-view';

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

/** Iranian week order: شنبه → جمعه */
const DAY_ORDER = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
] as const;

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

function dayKey(d: string): string {
  return String(d || '').toLowerCase();
}

function dayLabel(d: string): string {
  return DAY_FA[d] || DAY_FA[dayKey(d)] || d;
}

/** Strip seconds if present: "08:00:00" → "8:00" */
function fmtTime(t: string): string {
  const parts = String(t || '').split(':');
  if (parts.length < 2) return t;
  const h = String(Number(parts[0]));
  const m = parts[1].padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Compact one-line summary, e.g.
 * «از شنبه تا پنجشنبه از ساعت 8:00 تا 20:00»
 * Issue #28 — no card / grid of days.
 */
function summarizeWorkingHours(hours: WorkingHour[]): string | null {
  const active = (hours || []).filter((h) => h.isActive !== false);
  if (!active.length) return null;

  const byDay = new Map<string, { start: string; end: string }>();
  for (const h of active) {
    const k = dayKey(h.dayOfWeek);
    const prev = byDay.get(k);
    // Prefer earliest start / latest end if multiple slots same day
    if (!prev) {
      byDay.set(k, { start: h.startTime, end: h.endTime });
    } else {
      byDay.set(k, {
        start: h.startTime < prev.start ? h.startTime : prev.start,
        end: h.endTime > prev.end ? h.endTime : prev.end,
      });
    }
  }

  const ordered = DAY_ORDER.filter((d) => byDay.has(d));
  if (!ordered.length) return null;

  type Range = { from: string; to: string; start: string; end: string };
  const ranges: Range[] = [];
  for (const d of ordered) {
    const slot = byDay.get(d)!;
    const last = ranges[ranges.length - 1];
    if (
      last &&
      last.start === slot.start &&
      last.end === slot.end &&
      DAY_ORDER.indexOf(d as (typeof DAY_ORDER)[number]) ===
        DAY_ORDER.indexOf(last.to as (typeof DAY_ORDER)[number]) + 1
    ) {
      last.to = d;
    } else {
      ranges.push({ from: d, to: d, start: slot.start, end: slot.end });
    }
  }

  return ranges
    .map((r) => {
      const dayPart =
        r.from === r.to
          ? dayLabel(r.from)
          : `از ${dayLabel(r.from)} تا ${dayLabel(r.to)}`;
      return `${dayPart} از ساعت ${fmtTime(r.start)} تا ${fmtTime(r.end)}`;
    })
    .join(' · ');
}

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
  const hoursLine = summarizeWorkingHours(pro.workingHours || []);

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
                {(pro.status === 'approved' || !pro.status) && (
                  <p className="mt-1 text-xs font-medium text-emerald-700">✓ زیباگر تأییدشده بیوتی‌جو</p>
                )}
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
              {(() => {
                const loc =
                  pro.locations?.find(
                    (pl) => pl.location.latitude != null && pl.location.longitude != null,
                  )?.location || pro.locations?.[0]?.location;
                const lat = loc?.latitude != null ? Number(loc.latitude) : NaN;
                const lng = loc?.longitude != null ? Number(loc.longitude) : NaN;
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                return (
                  <div className="mt-4">
                    <LocationMapView position={{ lat, lng }} height="200px" />
                    <p className="mt-2 text-xs text-gray-muted">موقعیت تقریبی روی نقشه</p>
                  </div>
                );
              })()}
            </div>
          )}
        </aside>
      </div>

      {/* Issue #28: one short line at bottom — no card/grid */}
      {hoursLine && (
        <p className="mt-8 border-t border-border/60 pt-4 text-center text-sm text-gray">
          ساعات کاری: {hoursLine}
        </p>
      )}
    </div>
  );
}
