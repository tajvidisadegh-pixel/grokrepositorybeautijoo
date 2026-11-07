'use client';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PanelShell, type PanelNavItem } from '@/components/panel/panel-shell';
import { RequireAuth } from '@/components/auth/require-auth';
import { fetchProBookings, fetchMyProfessional } from '@/lib/panel-api';

const BASE_ITEMS: PanelNavItem[] = [
  { href: '/zibagar', label: 'داشبورد', mobile: true },
  { href: '/zibagar/bookings', label: 'رزروها', mobile: true },
  { href: '/zibagar/notifications', label: 'اعلان‌ها' },
  { href: '/zibagar/profile', label: 'پروفایل', mobile: true },
  { href: '/zibagar/reviews', label: 'نظرات' },
  { href: '/zibagar/services', label: 'منوی خدمات', mobile: true },
  { href: '/zibagar/portfolio', label: 'گالری نمونه‌کار', mobile: true },
  { href: '/zibagar/earnings', label: 'درآمد' },
  { href: '/zibagar/hours', label: 'ساعات کاری' },
  { href: '/zibagar/locations', label: 'آدرس' },
  { href: '/zibagar/support', label: 'پشتیبانی' },
  { href: '/zibagar/settings', label: 'تنظیمات' },
];

const PRO_ROLES = ['professional', 'admin', 'SUPER_ADMIN'] as const;

const WIZARD_SAFE_PREFIXES = [
  '/zibagar/profile/complete',
  '/zibagar/support',
  '/zibagar/settings',
];

function metaTotal(raw: unknown): number {
  if (!raw || typeof raw !== 'object') return 0;
  const m = (raw as { meta?: { total?: number } }).meta;
  return typeof m?.total === 'number' ? m.total : 0;
}

export default function ZibagarLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [pendingBookings, setPendingBookings] = useState(0);
  const [gateChecked, setGateChecked] = useState(false);
  const [mustCompleteWizard, setMustCompleteWizard] = useState(false);

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

  // Soft gate: only pure draft + incomplete. Never block approved/pending_review.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const onSafe = WIZARD_SAFE_PREFIXES.some((p) => pathname.startsWith(p));
      if (onSafe) {
        if (!cancelled) {
          setMustCompleteWizard(false);
          setGateChecked(true);
        }
        return;
      }
      try {
        const pro = await fetchMyProfessional();
        if (cancelled) return;
        const status = (pro?.status || '').toLowerCase();
        const complete = !!pro?.completion?.complete;
        const needsWizard = status === 'draft' && !complete;
        setMustCompleteWizard(needsWizard);
        if (needsWizard) {
          router.replace('/zibagar/profile/complete');
        }
      } catch {
        if (!cancelled) setMustCompleteWizard(false);
      } finally {
        if (!cancelled) setGateChecked(true);
      }
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

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
                بازگشت به پنل
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
      {mustCompleteWizard && gateChecked ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-950">
          <p className="font-medium">برای استفاده از پنل، ابتدا پروفایل را مرحله‌به‌مرحله تکمیل کنید.</p>
          <a href="/zibagar/profile/complete" className="mt-3 inline-block text-coral underline">
            ادامه تکمیل پروفایل
          </a>
        </div>
      ) : (
        children
      )}
    </PanelShell>
  );
}
