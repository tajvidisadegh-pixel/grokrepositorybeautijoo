'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PanelShell, type PanelNavItem } from '@/components/panel/panel-shell';
import { apiClient } from '@/lib/api';

type NavBadges = {
  professionals?: number;
  bookings?: number;
  reviews?: number;
  support?: number;
  media?: number;
  notifications?: number;
};

const BASE_ITEMS: Array<PanelNavItem & { badgeKey?: keyof NavBadges }> = [
  { href: '/admin', label: 'داشبورد' },
  { href: '/admin/finance', label: 'مدیریت مالی' },
  { href: '/admin/users', label: 'مشتریان' },
  { href: '/admin/notifications', label: 'اعلان‌ها', badgeKey: 'notifications' },
  { href: '/admin/professionals', label: 'زیباگرها', badgeKey: 'professionals' },
  { href: '/admin/service-categories', label: 'تخصص‌ها و دسته‌بندی‌ها' },
  { href: '/admin/bookings', label: 'رزروها', badgeKey: 'bookings' },
  { href: '/admin/reviews', label: 'نظرات و امتیازها', badgeKey: 'reviews' },
  { href: '/admin/media', label: 'رسانه‌ها', badgeKey: 'media' },
  { href: '/admin/site-builder', label: 'طراحی سایت' },
  { href: '/admin/support', label: 'پشتیبانی', badgeKey: 'support' },
  { href: '/admin/settings', label: 'تنظیمات' },
  { href: '/admin/audit', label: 'لاگ فعالیت‌ها' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [badges, setBadges] = useState<NavBadges>({});

  const refresh = useCallback(async () => {
    try {
      const data = await apiClient.get<NavBadges>('/admin/nav-badges');
      setBadges(data || {});
    } catch {
      /* non-blocking */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 60_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const items = useMemo(
    () =>
      BASE_ITEMS.map(({ badgeKey, ...item }) => ({
        ...item,
        badge: badgeKey ? Number(badges[badgeKey] || 0) : undefined,
      })),
    [badges],
  );

  return (
    <PanelShell title="پنل ادمین" items={items} roles={['admin', 'SUPER_ADMIN']}>
      {children}
    </PanelShell>
  );
}
