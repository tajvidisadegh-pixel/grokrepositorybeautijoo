'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { LogoMark } from '@/components/brand/logo';

const NAV = [
  { href: '/', label: 'خانه' },
  { href: '/search', label: 'جستجو' },
  { href: '/professionals', label: 'زیباگران' },
  { href: '/about', label: 'درباره ما' },
];

export function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated, loading, logout, hasRole } = useAuth();
  const [open, setOpen] = useState(false);

  const displayName =
    user?.profile?.displayName ||
    user?.phone ||
    'کاربر';

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0" onClick={() => setOpen(false)}>
          <LogoMark className="h-8 w-8" />
          <span className="text-base font-bold text-navy sm:text-lg">بیوتی‌جو</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-coral-soft text-coral'
                    : 'text-gray hover:bg-gray-light hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/search"
            className="flex size-11 min-h-11 min-w-11 items-center justify-center rounded-xl text-gray transition-colors hover:bg-coral-soft hover:text-coral md:hidden"
            aria-label="جستجو"
          >
            <Search className="size-5" aria-hidden />
          </Link>

          {isAuthenticated ? (
            <div className="hidden items-center gap-2 sm:flex">
              {hasRole('SUPER_ADMIN') || hasRole('admin') ? (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 rounded-xl border border-blue/30 bg-blue-soft px-3 py-1.5 text-xs font-bold text-blue shadow-sm transition-all hover:bg-blue hover:text-white sm:text-sm"
                >
                  پنل ادمین
                </Link>
              ) : null}
              {user?.accountType === 'professional' || hasRole('professional') ? (
                <Link
                  href="/zibagar"
                  className="rounded-xl px-3 py-1.5 text-sm font-medium text-foreground hover:bg-gray-light"
                >
                  میز کار من
                </Link>
              ) : (
                <Link
                  href="/panel"
                  className="rounded-xl px-3 py-1.5 text-sm font-medium text-foreground hover:bg-gray-light"
                >
                  حساب من
                </Link>
              )}
              <span className="hidden text-sm text-gray sm:inline">{displayName}</span>
              {(hasRole('SUPER_ADMIN') || hasRole('admin')) && (
                <span className="hidden text-xs font-medium text-gray sm:inline">مدیر کل سیستم</span>
              )}
              <Button size="sm" variant="outline" onClick={() => void logout()}>
                خروج
              </Button>
            </div>
          ) : (
            !loading && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* #67 — ورود همیشه در هدر موبایل دیده شود */}
                <Link
                  href="/login"
                  className="inline-flex h-11 min-h-11 items-center rounded-xl px-2.5 text-sm font-semibold text-coral transition-colors hover:bg-coral-soft sm:px-3 sm:font-medium sm:text-foreground sm:hover:bg-gray-light"
                >
                  ورود
                </Link>
                <Link href="/register" className="hidden sm:inline-flex">
                  <Button size="sm">ثبت‌نام</Button>
                </Link>
              </div>
            )
          )}

          <button
            type="button"
            className="flex size-11 min-h-11 min-w-11 items-center justify-center rounded-xl text-gray transition-colors hover:bg-coral-soft hover:text-coral md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'بستن منو' : 'باز کردن منو'}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-nav"
          className="border-t border-border bg-white md:hidden"
        >
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-xl px-3 py-3 text-sm font-medium ${
                    active ? 'bg-coral-soft text-coral' : 'text-foreground hover:bg-gray-light'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {isAuthenticated ? (
              <>
                {(hasRole('SUPER_ADMIN') || hasRole('admin')) && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-3 text-sm font-medium text-blue"
                  >
                    پنل ادمین
                  </Link>
                )}
                <Link
                  href={user?.accountType === 'professional' || hasRole('professional') ? '/zibagar' : '/panel'}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-sm font-medium"
                >
                  {user?.accountType === 'professional' || hasRole('professional')
                    ? 'میز کار من'
                    : 'حساب من'}
                </Link>
                <button
                  type="button"
                  className="rounded-xl px-3 py-3 text-right text-sm font-medium text-red-600"
                  onClick={() => {
                    setOpen(false);
                    void logout();
                  }}
                >
                  خروج
                </button>
              </>
            ) : (
              !loading && (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-3 text-sm font-semibold text-coral"
                  >
                    ورود
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-3 text-sm font-medium"
                  >
                    ثبت‌نام
                  </Link>
                </>
              )
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
