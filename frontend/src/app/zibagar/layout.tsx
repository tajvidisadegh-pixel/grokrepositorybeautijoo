'use client';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { PanelShell, type PanelNavItem } from '@/components/panel/panel-shell';
import { RequireAuth } from '@/components/auth/require-auth';
import { fetchProBookings } from '@/lib/panel-api';

const BASE_ITEMS: PanelNavItem[] = [
  { href: '/zibagar', label: 'داشبورد', mobile: true },
  { href: '/zibagar/bookings', label: 'رزروها', mobile: true },
  { href: '/zibagar/notifications', label: 'اعلان‌ها', mobile: true },
  { href: '/zibagar/profile', label: 'پروفایل', mobile: true },
  { href: '/zibagar/reviews', label: 'نظرات' },
  { href: '/zibagar/services', label: 'منوی خدمات', mobile: true },
  { href: '/zibagar/portfolio', label: 'نمونه‌کار' },
  { href: '/zibagar/earnings', label: 'درآمد' },
  { href: '/zibagar/hours', label: 'ساعات کاری' },
  { href: '/zibagar/locations', label: 'آدرس' },
  { href: '/zibagar/support', label: 'پشتیبانی' },
  { href: '/zibagar/settings', label: 'تنظیمات' },
];

const PRO_ROLES = ['professional', 'admin', 'SUPER_ADMIN'] as const;

function metaTotal(raw: unknown): number {
  if (!raw || typeof raw !== 'object') return 0;
  const m = (raw as { meta?: { total?: number } }).meta;
  return typeof m?.total === 'number' ? m.total : 0;
}

export default function ZibagarLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const [pendingBookings, setPendingBookings] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetchProBookings(1, 1, { status: 'pending' });
        if (!cancelled) setPendingBookings(metaTotal(res.raw) || res.items.length);
      } catch {
        if (!cancelled) setPendingBookings(0);
      }
    }
    void load();
    const t = window.setInterval(load, 60_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [pathname]);

  const items = useMemo(
    () =>
      BASE_ITEMS.map((it) =>
        it.href === '/zibagar/bookings' && pendingBookings > 0
          ? { ...it, badge: pendingBookings }
          : it,
      ),
    [pendingBookings],
  );

  if (pathname.startsWith('/zibagar/profile/complete')) {
    return (
      <RequireAuth roles={[...PRO_ROLES]}>
        <div className="min-h-screen bg-gray-light">
          <header className="border-b border-border bg-white">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
              <span className="text-sm font-bold text-coral">تکمیل پروفایل زیباگر</span>
              <a href="/zibagar" className="text-sm text-blue hover:underline">
                ذخیره و خروج به پنل
              </a>
            </div>
          </header>
          <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
        </div>
      </RequireAuth>
    );
  }
  return (
    <PanelShell title="پنل زیباگر" items={items} roles={[...PRO_ROLES]}>
      {children}
    </PanelShell>
  );
}
