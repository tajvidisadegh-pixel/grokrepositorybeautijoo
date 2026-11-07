'use client';

import type { ReactNode } from 'react';
import { PanelShell, type PanelNavItem } from '@/components/panel/panel-shell';

const items: PanelNavItem[] = [
  { href: '/panel', label: 'داشبورد', mobile: true },
  { href: '/panel/bookings', label: 'رزروها', mobile: true },
  { href: '/panel/favorites', label: 'علاقه‌مندی‌ها' },
  { href: '/panel/notifications', label: 'اعلان‌ها' },
  { href: '/panel/profile', label: 'پروفایل', mobile: true },
  { href: '/panel/settings', label: 'تنظیمات' },
  { href: '/panel/support', label: 'پشتیبانی', mobile: true },
];

/** Customer panel — roles must match JWT account/role names used by RequireAuth. */
const CUSTOMER_ROLES = ['customer', 'admin', 'SUPER_ADMIN'] as const;

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <PanelShell title="پنل کاربر" items={items} roles={[...CUSTOMER_ROLES]}>
      {children}
    </PanelShell>
  );
}
