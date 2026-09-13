'use client';
import type { ReactNode } from 'react';
import { PanelShell } from '@/components/panel/panel-shell';

const ITEMS = [
  { href: '/admin', label: 'داشبورد' },
  { href: '/admin/finance', label: 'مدیریت مالی' },
  { href: '/admin/users', label: 'مشتریان' },
  { href: '/admin/notifications', label: 'اعلان‌ها' },
  { href: '/admin/professionals', label: 'زیباگرها' },
  { href: '/admin/service-categories', label: 'تخصص‌ها و دسته‌بندی‌ها' },
  { href: '/admin/bookings', label: 'رزروها' },
  { href: '/admin/reviews', label: 'نظرات و امتیازها', disabled: true },
  { href: '/admin/media', label: 'رسانه‌ها', disabled: true },
  { href: '/admin/site-builder', label: 'طراحی سایت' },
  { href: '/admin/settings', label: 'تنظیمات', disabled: true },
  { href: '/admin/audit', label: 'لاگ فعالیت‌ها' },
];

/** SUPER_ADMIN and legacy admin — matches backend RolesGuard full-access roles. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PanelShell title="پنل سوپر ادمین" items={ITEMS} roles={['SUPER_ADMIN', 'admin']}>
      {children}
    </PanelShell>
  );
}
