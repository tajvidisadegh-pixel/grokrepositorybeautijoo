'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** Simple pulse block used by skeletons */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200/80 dark:bg-gray-700/50 ${className}`}
      aria-hidden
    />
  );
}

/** List-style skeleton for panel/admin pages */
export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="در حال بارگذاری">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border bg-background p-4 space-y-3"
        >
          <div className="flex justify-between gap-3">
            <SkeletonBlock className="h-4 w-1/3" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
          <SkeletonBlock className="h-3 w-2/3" />
          <SkeletonBlock className="h-3 w-1/2" />
        </div>
      ))}
      <span className="sr-only">در حال بارگذاری...</span>
    </div>
  );
}

/** Card-grid skeleton (e.g. favorites, professionals) */
export function GridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="در حال بارگذاری"
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border p-4">
          <SkeletonBlock className="h-28 w-full rounded-xl" />
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-3 w-1/2" />
        </div>
      ))}
      <span className="sr-only">در حال بارگذاری...</span>
    </div>
  );
}

export function PanelLoading({
  label = 'در حال بارگذاری...',
  skeleton = true,
  rows = 4,
  grid = false,
  cards = 6,
}: {
  label?: string;
  /** Default true — list skeleton instead of plain text */
  skeleton?: boolean;
  rows?: number;
  /** Card-grid skeleton */
  grid?: boolean;
  cards?: number;
}) {
  if (grid) return <GridSkeleton cards={cards} />;
  if (skeleton) return <PanelSkeleton rows={rows} />;
  return (
    <div
      className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-sm text-gray"
      role="status"
      aria-live="polite"
    >
      <span
        className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-coral border-t-transparent"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}

export function PanelError({
  message,
  onRetry,
  title = 'خطا در دریافت اطلاعات',
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div
      className="rounded-2xl border border-red-100 bg-red-50 px-4 py-8 text-center dark:border-red-900/40 dark:bg-red-950/30"
      role="alert"
    >
      <p className="text-2xl" aria-hidden>
        ⚠️
      </p>
      <p className="mt-2 text-sm font-medium text-red-800 dark:text-red-200">{title}</p>
      <p className="mt-1 text-sm text-red-700 dark:text-red-300">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          تلاش مجدد
        </Button>
      )}
    </div>
  );
}

export function PanelEmpty({
  title,
  description,
  action,
  icon = '📭',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-gray-light/40 px-4 py-12 text-center">
      {icon && (
        <p className="text-3xl" aria-hidden>
          {icon}
        </p>
      )}
      <p className={`font-semibold text-foreground ${icon ? 'mt-3' : ''}`}>{title}</p>
      {description && <p className="mt-1 text-sm text-gray">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
