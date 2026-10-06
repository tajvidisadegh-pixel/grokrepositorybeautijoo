'use client';

import { cn } from '@/lib/utils';
import { getOpenStatus, type HourSlot } from '@/lib/open-status';

type Props = {
  hours?: HourSlot[] | null;
  className?: string;
  /** Show today's time range next to badge */
  showRange?: boolean;
  size?: 'sm' | 'md';
};

export function OpenStatusBadge({
  hours,
  className,
  showRange = false,
  size = 'sm',
}: Props) {
  const status = getOpenStatus(hours);

  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        status.kind === 'open' && 'bg-emerald-50 text-emerald-800',
        status.kind === 'closed' && 'bg-gray-100 text-gray-600',
        status.kind === 'unknown' && 'bg-amber-50 text-amber-800',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block size-1.5 rounded-full',
          status.kind === 'open' && 'bg-emerald-500',
          status.kind === 'closed' && 'bg-gray-400',
          status.kind === 'unknown' && 'bg-amber-500',
        )}
        aria-hidden
      />
      {status.badge}
      {showRange && status.todayRangeLabel && (
        <span className="font-normal opacity-80">· {status.todayRangeLabel}</span>
      )}
    </span>
  );
}
