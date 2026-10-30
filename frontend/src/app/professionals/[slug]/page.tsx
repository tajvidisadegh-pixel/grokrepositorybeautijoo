import { ProfileViewTracker } from '@/components/analytics/profile-view-tracker';
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
import { SalonMediaGallery } from '@/components/professionals/salon-media-gallery';
import type { ProfessionalServiceItem, WorkingHour } from '@/types/public';
import LocationMapView from '@/components/location/location-map-view'
import { StickyBookBar } from '@/components/professionals/sticky-book-bar';
import { OpenStatusBadge } from '@/components/professionals/open-status-badge';

type Props = {
  params: Promise<{ slug: string }>;
};

/** Relative Persian label for last activity (#40 item 32) */
function formatProfileUpdated(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'پروفایل امروز به‌روز شده';
  if (days === 1) return 'پروفایل دیروز به‌روز شده';
  if (days < 30) return `پروفایل آخرین بار ${days.toLocaleString('fa-IR')} روز پیش به‌روز شده`;
  return null;
}
function formatLastActivity(iso?: string | null): string | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return null;
  const diffMin = Math.floor((Date.now() - ts) / 60000);
  if (diffMin < 0) return null;
  if (diffMin < 15) return 'آنلاین اخیراً';
  if (diffMin < 60) return `آخرین فعالیت: ${diffMin} دقیقه پیش`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `آخرین فعالیت: ${h} ساعت پیش`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'آخرین فعالیت: دیروز';
  if (d < 7) return `آخرین فعالیت: ${d} روز پیش`;
  if (d < 30) return `آخرین فعالیت: ${Math.floor(d / 7)} هفته پیش`;
  return 'آخرین فعالیت: بیش از یک ماه پیش';
}

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

function fmtTime(t: string): string {
  const parts = String(t || '').split(':');
  if (parts.length < 2) return t;
  const h = String(Number(parts[0]));
  const m = parts[1].padStart(2, '0');
  return `${h}:${m}`;
}

function summarizeWorkingHours(hours: WorkingHour[]): string | null {
  const active = (hours || []).filter((h) => h.isActive !== false);
  if (!active.length) return null;

  const byDay = new Map<string, { start: string; end: string }>();
  for (const h of active) {
    const k = dayKey(h.dayOfWeek);
    const prev = byDay.get(k);
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
  const coverUrl =
    (pro as { coverImageUrl?: string | null }).coverImageUrl ||
    null;
  const rating =
    pro.ratingAvg != null ? Number(pro.ratingAvg).toFixed(1) : null;
  const hasRating = rating && (pro.ratingCount ?? 0) > 0;
  const jsonLd = professionalJsonLd(pro);
  const hoursLine = summarizeWorkingHours(pro.workingHours || []);
  const memberSince = (pro as { createdAt?: string }).createdAt
    ? new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'long',
        timeZone: 'Asia/Tehran',
      }).format(new Date((pro as { createdAt?: string }).createdAt!))
    : null;
  const lastAct = formatLastActivity(
    (pro as { user?: { lastLoginAt?: string | null } }).user?.lastLoginAt,
  );
  const profileUpd = formatProfileUpdated(
    (pro as { updatedAt?: string | null }).updatedAt,
  );

  const salonMedia = (pro.mediaAssets || []).filter(
    (m) => m.kind === 'salon' && (m.publicUrl || (m as { url?: string }).url),
  );
  // fallback cover from first salon photo if no dedicated cover
  const bannerUrl =
    coverUrl ||
    (salonMedia[0]
      ? (salonMedia[0].publicUrl || (salonMedia[0] as { url?: string }).url) || null
      : null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 pb-24 md:pb-10">
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
          <ProfileViewTracker proId={pro.id} />
          {/* #65.8 — summary hero: cover banner + avatar + name + rating */}
          <header className="overflow-hidden rounded-3xl border border-border/90 bg-white shadow-[0_1px_3px_rgba(31,41,55,0.05)]">
            <div className="relative h-36 w-full bg-gradient-to-l from-coral-soft via-coral/20 to-white sm:h-44">
              {bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bannerUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
              {hasRating ? (
                <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-sm font-semibold text-amber-600 shadow-sm backdrop-blur-sm">
                  <span className="text-amber-500">★</span>
                  <span>{rating}</span>
                  <span className="text-xs font-normal text-gray">
                    ({Number(pro.ratingCount).toLocaleString('fa-IR')} نظر)
                  </span>
                </div>
              ) : (
                <div className="absolute left-4 top-4 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-coral shadow-sm backdrop-blur-sm">
                  زیباگر جدید
                </div>
              )}
            </div>
            <div className="relative -mt-10 flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-end sm:gap-4 sm:px-6 sm:pb-6">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-coral-soft text-2xl font-bold text-coral shadow-md ring-1 ring-border/60 sm:size-24">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt={name} className="size-full object-cover" />
                ) : (
                  name.charAt(0)
                )}
              </div>
              <div className="min-w-0 flex-1 pt-1 sm:pt-0">
                <h1 className="text-xl font-bold text-blue sm:text-2xl">{name}</h1>
                {pro.title && pro.title !== name && (
                  <p className="mt-0.5 text-sm text-gray">{pro.title}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray">
                  {pro.locations?.[0]?.location?.city && (
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden>📍</span>
                      {pro.locations[0].location.city}
                    </span>
                  )}
                  {(pro as { completedBookingsCount?: number }).completedBookingsCount != null &&
                    Number((pro as { completedBookingsCount?: number }).completedBookingsCount) > 0 && (
                      <span className="text-xs text-gray">
                        بیش از {Number((pro as { completedBookingsCount?: number }).completedBookingsCount).toLocaleString('fa-IR')} نوبت موفق
                      </span>
                    )}
                </div>
              </div>
            </div>
          </header>

          {/* #65.6 — photos & portfolio before bio/about */}
          {salonMedia.length > 0 && <SalonMediaGallery media={salonMedia} />}

          <ServicePortfolioGallery
            slug={pro.slug}
            services={(pro.professionalServices || []) as ProfessionalServiceItem[]}
          />

          {pro.bio && (
            <section className="rounded-3xl border border-border/90 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-foreground">درباره زیباگر</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray">
                {pro.bio}
              </p>
            </section>
          )}

          <section className="rounded-3xl border border-border/90 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground">خدمات و قیمت{(pro.professionalServices?.length ?? 0) > 0 && (<span className="mr-2 text-sm font-normal text-gray"> ({(pro.professionalServices?.length ?? 0).toLocaleString("fa-IR")} خدمت)</span>)}</h2>
            {(!pro.professionalServices ||
              pro.professionalServices.length === 0) && (
              <p className="mt-3 text-sm text-gray">خدمتی ثبت نشده است.</p>
            )}
            <ul className="mt-4 space-y-3">
              {(() => {
                const list = [...(pro.professionalServices || [])] as ProfessionalServiceItem[];
                const pins = ((pro as { socialLinks?: { _pinnedServiceIds?: string[] } }).socialLinks?._pinnedServiceIds) || [];
                const orderIds = ((pro as { socialLinks?: { _serviceOrderIds?: string[] } }).socialLinks?._serviceOrderIds) || [];
                const pinSet = new Set(pins);
                list.sort((a, b) => {
                  const ap = pinSet.has(a.id) ? 0 : 1;
                  const bp = pinSet.has(b.id) ? 0 : 1;
                  if (ap !== bp) return ap - bp;
                  const ai = orderIds.indexOf(a.id);
                  const bi = orderIds.indexOf(b.id);
                  if (ai >= 0 && bi >= 0) return ai - bi;
                  if (ai >= 0) return -1;
                  if (bi >= 0) return 1;
                  return 0;
                });
                return list.map((s) => (
                  <li key={s.id}>
                    <ServiceOfferCard service={s} slug={pro.slug} pinned={pinSet.has(s.id)} />
                  </li>
                ));
              })()}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-border/90 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-foreground">رزرو نوبت</h2>
            <p className="mt-2 text-sm text-gray">
              برای مشاهده زمان‌های آزاد و رزرو آنلاین روی دکمه زیر بزنید.
            </p>
            <Link
              href={`/booking/${pro.slug}`}
              className="mt-4 flex w-full items-center justify-center rounded-2xl bg-coral px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-coral-dark"
            >
              رزرو نوبت
            </Link>
          </div>

          {pro.locations && pro.locations.length > 0 && (
            <div className="rounded-3xl border border-border/90 bg-white p-6 shadow-sm">
              <h2 className="font-bold text-foreground">آدرس</h2>
              <ul className="mt-3 space-y-3">
                {pro.locations.map((pl) => (
                  <li key={pl.location.id}>
                    <p className="text-sm font-medium text-foreground">{pl.location.name || pl.location.city}</p>
                    {pl.location.precision === 'exact' && pl.location.address ? (
                      <p className="text-xs text-gray-muted">{pl.location.address}</p>
                    ) : (
                      <p className="text-xs text-gray-muted">آدرس دقیق پس از تأیید نوبت</p>
                    )}
                    <Link
                      href={`/professionals?city=${encodeURIComponent(pl.location.city || '')}`}
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
                    <LocationMapView position={{ lat, lng }} height="200px" precision="approximate" />
                    <p className="mt-2 text-xs text-gray-muted">مسیریابی و نقشه از طریق نشان</p>
                  </div>
                );
              })()}
            </div>
          )}
        </aside>
      </div>

      {hoursLine && (
        <p className="mt-8 border-t border-border/60 pt-4 text-center text-sm text-gray">
          <OpenStatusBadge hours={pro.workingHours || []} showRange size="md" />{hoursLine ? <span className="text-sm text-gray"> · {hoursLine}</span> : null}
        </p>
      )}

      {/* #65.7 — member / last-updated tiny footer under hours */}
      {(memberSince || lastAct || profileUpd) && (
        <p className="mt-2 text-center text-[11px] leading-5 text-gray-muted">
          {[memberSince ? `عضو از ${memberSince}` : null, lastAct, profileUpd]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      <p className="mt-3 text-center text-xs text-gray-muted">شماره تماس زیباگر پس از تأیید رزرو در پنل شما نمایش داده می‌شود.</p>
      <p className="mt-2 text-center text-xs text-gray-muted">رزرو آنلاین مشمول حداقل زمان از قبل و ظرفیت روز زیباگر است؛ اسلات‌های پر قابل انتخاب نیستند.</p>
      <p className="mt-4 text-center text-xs text-gray-muted">
        تخلف مشاهده کردید؟{' '}
        <a
          href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@beautijoo.ir'}?subject=${encodeURIComponent('گزارش تخلف پروفایل: ' + pro.slug)}`}
          className="text-coral underline"
        >
          گزارش تخلف
        </a>
      </p>
      <StickyBookBar slug={pro.slug} />
    </div>
  );
}
