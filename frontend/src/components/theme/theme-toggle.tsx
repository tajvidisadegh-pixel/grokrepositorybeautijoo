'use client';

import { useTheme } from '@/components/theme/theme-provider';

/** Compact dark/light toggle for header (issue #38). */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'حالت روشن' : 'حالت تاریک'}
      title={isDark ? 'حالت روشن' : 'حالت تاریک'}
      className={`inline-flex size-9 items-center justify-center rounded-xl border border-border bg-white text-sm text-foreground transition-colors hover:bg-gray-light ${className}`}
    >
      <span aria-hidden>{isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}
