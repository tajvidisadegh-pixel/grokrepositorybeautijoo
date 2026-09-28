'use client';
import type { ReactNode } from 'react';
import { PanelShell } from '@/components/panel/panel-shell';

const ITEMS = [
  { href: '/panel', label: 'داشبورد', mobile: true },
  { href: '/panel/bookings', label: 'رزروها', mobile: true },
  { href: '/panel/favorites', label: 'علاقه‌مندی‌ها' },
  { href: '/panel/reviews', label: 'نظرات' },
  { href: '/panel/notifications', label: 'اعلان‌ها', mobile: true },
  { href: '/panel/profile', label: 'پروفایل', mobile: true },
  { href: '/panel/settings', label: 'تنظیمات', mobile: true },
];

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <PanelShell
      title="پنل مشتری"
      items={ITEMS}
      roles={['customer', 'admin', 'SUPER_ADMIN']}
    >
      {children}
    </PanelShell>
  );
}
