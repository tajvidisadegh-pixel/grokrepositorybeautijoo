'use client';

import { PanelShell } from '@/components/panel/panel-shell';

const links = [
  { href: '/panel', label: 'داشبورد' },
  { href: '/panel/bookings', label: 'رزروها' },
  { href: '/panel/favorites', label: 'علاقه‌مندی‌ها' },
  { href: '/panel/notifications', label: 'اعلان‌ها' },
  { href: '/panel/profile', label: 'پروفایل' },
  { href: '/panel/settings', label: 'تنظیمات' },
  { href: '/panel/support', label: 'پشتیبانی' },
];

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PanelShell
      title="پنل کاربر"
      requiredAccountType="customer"
      links={links}
    >
      {children}
    </PanelShell>
  );
}
