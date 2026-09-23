import Link from 'next/link';
import type { ProfessionalListItem } from '@/types/public';
import { cn, formatDistanceFromYou } from '@/lib/utils';

type Props = {
  pro: ProfessionalListItem;
  className?: string;
};

export function ProfessionalCard({ pro, className }: Props) {
  const name = pro.user?.profile?.displayName || pro.title;
  const avatar = pro.user?.profile?.avatarUrl;
  const city = pro.locations?.[0]?.location?.city;
  const services =
    pro.professionalServices?.map((s) => s.service.name).filter(Boolean) || [];
  const rating =
    pro.ratingAvg != null ? Number(pro.ratingAvg).toFixed(1) : null;
  const count = pro.ratingCount ?? 0;

  return (
    <Link
      href={`/professionals/${pro.slug}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-border/90 bg-white shadow-[0_1px_3px_rgba(31,41,55,0.05)] transition-all hover:border-coral/25 hover:shadow-[0_4px_14px_rgba(252,112,116,0.12)] sm:rounded-3xl',
        className,
      )}
    >
      <div className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-coral-soft text-base font-bold text-coral sm:size-14 sm:text-lg">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={name}
              className="size-full object-cover"
            />
          ) : (
            (name || 'ز').charAt(0)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-blue sm:text-base">
              {name}
            </h3>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {pro.isFeatured && (
                <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-medium text-coral sm:text-xs">
                  ویژه
                </span>
              )}
              {(pro.status === 'approved' || !pro.status) && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 sm:text-xs">
                  ✓ تأییدشده
                </span>
              )}
            </div>
          </div>
          {pro.title && pro.title !== name && (
            <p className="mt-0.5 truncate text-xs text-gray sm:text-sm">{pro.title}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-muted sm:mt-2">
            {rating && count > 0 && (
              <span className="text-amber-500">
                ★ {rating}{' '}
                <span className="text-gray-muted">({count} نظر)</span>
              </span>
            )}
            {city && <span>{city}</span>}
            {pro.distanceKm != null && Number.isFinite(pro.distanceKm) && (
              <span className="text-coral">
                {formatDistanceFromYou(
                  pro.distanceKm,
                  (pro as { distanceApproximate?: boolean }).distanceApproximate,
                )}
              </span>
            )}
          </div>
          {services.length > 0 && (
            <p className="mt-1.5 line-clamp-1 text-xs text-gray-muted sm:mt-2">
              {services.slice(0, 3).join(' · ')}
            </p>
          )}
        </div>
      </div>
      <div className="mt-auto border-t border-border/80 bg-coral-soft/40 px-4 py-2.5 sm:px-5 sm:py-3">
        <span className="text-sm font-medium text-coral transition-colors group-hover:text-coral-dark">
          مشاهده پروفایل
        </span>
      </div>
    </Link>
  );
}
