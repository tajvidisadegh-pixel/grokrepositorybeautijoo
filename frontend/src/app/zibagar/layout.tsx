'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PanelShell } from '@/components/panel/panel-shell';
import { RequireAuth } from '@/components/auth/require-auth';

const ITEMS = [
  { href: '/zibagar', label: 'داشبورد' },
  { href: '/zibagar/bookings', label: 'رزروها' },
  { href: '/zibagar/reviews', label: 'نظرات' },
  { href: '/zibagar/services', label: 'تخصص‌ها و منو قیمت' },
  { href: '/zibagar/portfolio', label: 'نمونه‌کار' },
  { href: '/zibagar/earnings', label: 'درآمد و تسویه' },
  { href: '/zibagar/profile', label: 'پروفایل' },
  { href: '/zibagar/hours', label: 'ساعات کاری' },
  { href: '/zibagar/locations', label: 'مکان کار' },
  { href: '/zibagar/notifications', label: 'اعلان‌ها' },
  { href: '/zibagar/settings', label: 'تنظیمات' },
];

const PRO_ROLES = ['professional', 'admin', 'SUPER_ADMIN'] as const;

export default function ZibagarLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
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
    <PanelShell title="پنل زیباگر" items={ITEMS} roles={[...PRO_ROLES]}>
      {children}
    </PanelShell>
  );
}
