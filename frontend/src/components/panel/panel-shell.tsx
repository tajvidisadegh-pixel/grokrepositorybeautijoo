'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { RequireAuth } from '@/components/auth/require-auth';
import { fetchUnreadCount } from '@/lib/panel-api';

export type PanelNavItem = { href: string; label: string; disabled?: boolean };

type Props = { title: string; items: PanelNavItem[]; roles: string[]; children: ReactNode };

function isNotificationsHref(href: string): boolean {
  return href.endsWith('/notifications');
}

export function PanelShell({ title, items, roles, children }: Props) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetchUnreadCount();
      setUnread(typeof res?.count === 'number' ? res.count : 0);
    } catch {
      /* non-blocking: badge simply stays at last known value */
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

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('beautijoo:unread-changed', onUnreadChanged);
      }
    };
  }, [refreshUnread, pathname]);

  return (
    <RequireAuth roles={roles}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-8 md:flex-row">
          <aside className="w-full shrink-0 md:w-56">
            <h2 className="mb-4 text-lg font-bold text-foreground">{title}</h2>
            <nav className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
              {items.map((item) => {
                if (item.disabled) {
                  return (
                    <span
                      key={item.href}
                      aria-disabled="true"
                      className="flex cursor-not-allowed items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-gray/60"
                    >
                      {item.label}
                      <span className="rounded-full bg-gray-light px-2 py-0.5 text-[10px] font-normal text-gray">
                        به‌زودی
                      </span>
                    </span>
                  );
                }
                const active =
                  pathname === item.href ||
                  (item.href !== items[0]?.href && pathname?.startsWith(item.href + '/'));
                const showBadge = isNotificationsHref(item.href) && unread > 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition',
                      active ? 'bg-coral-soft text-coral' : 'text-gray hover:bg-gray-light',
                    )}
                  >
                    <span>{item.label}</span>
                    {showBadge && (
                      <span
                        className="inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-coral px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                        aria-label={`${unread} اعلان خوانده‌نشده`}
                      >
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
