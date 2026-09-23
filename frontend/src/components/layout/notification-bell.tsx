'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { fetchUnreadCount } from '@/lib/panel-api';

const POLL_MS = 45_000;

/**
 * Header bell with unread badge + smart polling (18.14).
 * Listens to focus / visibility / beautijoo:unread-changed.
 */
export function NotificationBell() {
  const { isAuthenticated, loading, hasRole } = useAuth();
  const [count, setCount] = useState(0);

  const href =
    hasRole('professional') && !hasRole('customer')
      ? '/zibagar/notifications'
      : '/panel/notifications';

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCount(0);
      return;
    }
    try {
      const res = await fetchUnreadCount();
      setCount(typeof res?.count === 'number' ? res.count : 0);
    } catch {
      /* non-blocking */
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (loading || !isAuthenticated) {
      setCount(0);
      return;
    }
    void refresh();

    const onFocus = () => void refresh();
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onChanged = () => void refresh();

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beautijoo:unread-changed', onChanged);
    const timer = window.setInterval(() => void refresh(), POLL_MS);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beautijoo:unread-changed', onChanged);
      window.clearInterval(timer);
    };
  }, [loading, isAuthenticated, refresh]);

  if (loading || !isAuthenticated) return null;

  return (
    <Link
      href={href}
      className="relative flex size-11 min-h-11 min-w-11 items-center justify-center rounded-xl text-gray transition-colors hover:bg-coral-soft hover:text-coral"
      aria-label={
        count > 0
          ? `${count.toLocaleString('fa-IR')} اعلان خوانده‌نشده`
          : 'اعلان‌ها'
      }
    >
      <Bell className="size-5" aria-hidden />
      {count > 0 && (
        <span
          className="absolute end-1.5 top-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold leading-none text-white"
          aria-hidden
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
