'use client';

import { useTheme } from '@/components/theme/theme-provider';

/**
 * #65 item 1 — theme control lives in Settings only (not site header).
 * Compact icon button kept for optional reuse; prefer ThemeAppearance for settings UI.
 */
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

/** Full control for Settings pages: explicit light / dark. */
export function ThemeAppearance() {
  const { theme, setTheme } = useTheme();

  const btn = (value: 'light' | 'dark', label: string, icon: string) => {
    const active = theme === value;
    return (
      <button
        type="button"
        onClick={() => setTheme(value)}
        aria-pressed={active}
        className={`flex flex-1 flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm font-medium transition ${
          active
            ? 'border-coral bg-coral-soft text-coral'
            : 'border-border bg-white text-foreground hover:bg-gray-light'
        }`}
      >
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
        {label}
      </button>
    );
  };

  return (
    <div className="flex gap-2" role="group" aria-label="حالت نمایش">
      {btn('light', 'روشن', '☀️')}
      {btn('dark', 'تاریک', '🌙')}
    </div>
  );
}
