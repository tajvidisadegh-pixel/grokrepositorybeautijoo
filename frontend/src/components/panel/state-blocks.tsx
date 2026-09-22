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

export function PanelLoading({
  label = 'در حال بارگذاری...',
  skeleton = false,
  rows = 4,
}: {
  label?: string;
  /** When true, show list skeleton instead of centered text */
  skeleton?: boolean;
  rows?: number;
}) {
  if (skeleton) return <PanelSkeleton rows={rows} />;
  return (
    <div
      className="flex min-h-[30vh] items-center justify-center text-sm text-gray"
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  );
}

export function PanelError({
  message,
  onRetry,
  title = 'خطا',
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div
      className="rounded-2xl border border-red-100 bg-red-50 px-4 py-6 text-center"
      role="alert"
    >
      <p className="text-sm font-medium text-red-800">{title}</p>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
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
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-gray-light/40 px-4 py-12 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-gray">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
