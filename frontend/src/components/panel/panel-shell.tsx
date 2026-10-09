"use client";

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { RequireAuth } from '@/components/auth/require-auth';
import { fetchUnreadCount } from '@/lib/panel-api';

export type PanelNavItem = {
  href: string;
  label: string;
  disabled?: boolean;
  badge?: number;
  /** Show in mobile bottom bar (max ~5 recommended) */
  mobile?: boolean;
};

type Props = { title: string; items: PanelNavItem[]; roles: string[]; children: ReactNode };

function isPersonalNotificationsHref(href: string): boolean {
  return href === '/panel/notifications' || href === '/zibagar/notifications';
}

function NavLink({
  item,
  active,
  badgeCount,
  compact,
}: {
  item: PanelNavItem;
  active: boolean;
  badgeCount: number;
  compact?: boolean;
}) {
  if (item.disabled) {
    return (
      <span
        aria-disabled="true"
        className={cn(
          'flex cursor-not-allowed items-center justify-center gap-1 font-medium text-gray/60',
          compact ? 'flex-col px-1 py-1 text-[10px]' : 'justify-between rounded-xl px-3 py-2 text-sm',
        )}
      >
        <span className={compact ? 'line-clamp-1' : ''}>{item.label}</span>
        {!compact && (
          <span className="rounded-full bg-gray-light px-2 py-0.5 text-[10px] text-gray">به‌زودی</span>
        )}
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      className={cn(
        'relative flex items-center font-medium transition',
        compact
          ? cn(
              'flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px]',
              active ? 'text-coral' : 'text-gray',
            )
          : cn(
              'justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm',
              active ? 'bg-coral-soft text-coral' : 'text-gray hover:bg-gray-light',
            ),
      )}
    >
      <span className={compact ? 'line-clamp-1 max-w-[4.5rem] text-center' : ''}>{item.label}</span>
      {badgeCount > 0 && (
        <span
          className={cn(
            'inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-coral px-1 text-[9px] font-bold leading-none text-white',
            compact && 'absolute left-1 top-0.5',
          )}
          aria-label={`${badgeCount} مورد جدید`}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
      {compact && active && (
        <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-coral" aria-hidden />
      )}
    </Link>
  );
}

export function PanelShell({ title, items, roles, children }: Props) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetchUnreadCount();
      setUnread(typeof res?.count === 'number' ? res.count : 0);
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchUnreadCount();
        if (!cancelled) setUnread(typeof res?.count === 'number' ? res.count : 0);
      } catch {
        /* ignore */
      }
    })();

    const onFocus = () => {
      void refreshUnread();
    };
    const onUnreadChanged = () => {
      void refreshUnread();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
      window.addEventListener('beautijoo:unread-changed', onUnreadChanged);
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshUnread();
    }, 45_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('beautijoo:unread-changed', onUnreadChanged);
      }
    };
  }, [refreshUnread, pathname]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const badgeFor = useCallback(
    (item: PanelNavItem) => {
      const personalUnread =
        isPersonalNotificationsHref(item.href) && unread > 0 ? unread : 0;
      const itemBadge = typeof item.badge === 'number' && item.badge > 0 ? item.badge : 0;
      return personalUnread || itemBadge;
    },
    [unread],
  );

  const isActive = useCallback(
    (item: PanelNavItem) =>
      pathname === item.href ||
      (item.href !== items[0]?.href && !!pathname?.startsWith(item.href + '/')),
    [pathname, items],
  );

  const mobileItems = useMemo(() => {
    const marked = items.filter((i) => i.mobile && !i.disabled);
    if (marked.length > 0) return marked.slice(0, 5);
    return items.filter((i) => !i.disabled).slice(0, 5);
  }, [items]);

  const hasMobileNav = mobileItems.length > 0;

  return (
    <RequireAuth roles={roles}>
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden w-full shrink-0 md:block md:w-56">
            <h2 className="mb-4 text-lg font-bold text-foreground">{title}</h2>
            <nav className="flex flex-col gap-1">
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(item)}
                  badgeCount={badgeFor(item)}
                />
              ))}
            </nav>
          </aside>

          {/* Mobile header + expandable full menu */}
          <div className="md:hidden">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              <button
                type="button"
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-gray"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
              >
                {moreOpen ? 'بستن منو' : 'همه بخش‌ها'}
              </button>
            </div>
            {moreOpen && (
              <nav className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-white p-2">
                {items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(item)}
                    badgeCount={badgeFor(item)}
                  />
                ))}
              </nav>
            )}
          </div>

          <main className={cn('min-w-0 flex-1', hasMobileNav && 'pb-20 md:pb-0')}>{children}</main>
        </div>

        {/* Mobile bottom nav */}
        {hasMobileNav && (
          <nav
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur md:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            aria-label="ناوبری اصلی"
          >
            <div className="mx-auto flex max-w-6xl items-stretch justify-around">
              {mobileItems.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(item)}
                  badgeCount={badgeFor(item)}
                  compact
                />
              ))}
            </div>
          </nav>
        )}

        <p className="mt-8 text-center text-[10px] text-gray-muted" dir="ltr">
          beautijoo v{APP_VERSION}
        </p>
      </div>
    </RequireAuth>
  );
}
