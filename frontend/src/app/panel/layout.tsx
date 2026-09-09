'use client';
import type { ReactNode } from 'react';
import { PanelShell } from '@/components/panel/panel-shell';

const ITEMS = [
  { href: '/panel', label: 'داشبورد' },
  { href: '/panel/bookings', label: 'رزروهای من' },
  { href: '/panel/favorites', label: 'علاقه‌مندی‌ها' },
  { href: '/panel/reviews', label: 'نظرات' },
  { href: '/panel/notifications', label: 'اعلان‌ها' },
  { href: '/panel/profile', label: 'پروفایل' },
  { href: '/panel/settings', label: 'تنظیمات' },
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
