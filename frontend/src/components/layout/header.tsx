'use client';

import Link from 'next/link';
import { Search, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';

export function Header() {
  const { user, loading, logout, isAuthenticated, hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const displayName =
    user?.profile?.displayName || user?.phone || 'کاربر';

  // Escape closes mobile menu; restore focus to toggle
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    // Focus first link in mobile nav
    const t = window.setTimeout(() => {
      const first = menuRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      first?.focus();
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/95 backdrop-blur-md shadow-[0_1px_0_0_rgba(252,112,116,0.08)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:gap-4">
        <Logo />

        <nav
          className="hidden items-center gap-1 text-sm font-medium text-gray md:flex"
          aria-label="اصلی"
        >
          <Link
            href="/professionals"
            className="rounded-xl px-3 py-2 transition-colors hover:bg-coral-soft hover:text-coral"
          >
            زیباگران
          </Link>
          <Link
            href="/search"
            className="rounded-xl px-3 py-2 transition-colors hover:bg-coral-soft hover:text-coral"
          >
            جستجو
          </Link>
          <Link
            href="/services"
            className="rounded-xl px-3 py-2 transition-colors hover:bg-coral-soft hover:text-coral"
          >
            خدمات
          </Link>
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/search"
            className="flex size-11 min-h-11 min-w-11 items-center justify-center rounded-xl text-gray transition-colors hover:bg-coral-soft hover:text-coral md:hidden"
            aria-label="جستجو"
          >
            <Search className="size-5" aria-hidden />
          </Link>

          {!loading && isAuthenticated ? (
            <div className="hidden items-center gap-2 sm:flex">
              {hasRole('SUPER_ADMIN') && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 rounded-xl border border-blue/30 bg-blue-soft px-3 py-1.5 text-xs font-bold text-blue shadow-sm transition-all hover:bg-blue hover:text-white sm:text-sm"
                >
                  <span aria-hidden>👑</span>
                  <span>پنل سوپر ادمین</span>
                </Link>
              )}
              {hasRole('professional') && (
                <Link
                  href="/zibagar"
                  className="rounded-xl px-2 py-1.5 text-sm font-medium text-coral hover:bg-coral-soft"
                >
                  پنل زیباگر
                </Link>
              )}
              {hasRole('customer') && !hasRole('SUPER_ADMIN') && (
                <Link
                  href="/panel"
                  className="rounded-2xl bg-gray-light px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-gray-mid"
                >
                  پنل مشتری
                </Link>
              )}
              {!hasRole('customer') && hasRole('professional') && !hasRole('SUPER_ADMIN') && (
                <Link
                  href="/zibagar"
                  className="rounded-2xl bg-gray-light px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-gray-mid"
                >
                  {displayName}
                </Link>
              )}
              {hasRole('customer') && !hasRole('professional') && !hasRole('SUPER_ADMIN') && (
                <span className="hidden text-sm text-gray sm:inline">{displayName}</span>
              )}
              {hasRole('SUPER_ADMIN') && (
                <span className="hidden text-xs font-medium text-gray sm:inline">مدیر کل سیستم</span>
              )}
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                خروج
              </Button>
            </div>
          ) : (
            !loading && (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href="/login"
                  className="inline-flex h-11 min-h-11 items-center rounded-xl px-3 text-sm font-medium text-foreground transition-colors hover:bg-gray-light"
                >
                  ورود
                </Link>
                <Link href="/register">
                  <Button size="sm">ثبت‌نام</Button>
                </Link>
              </div>
            )
          )}

          <button
            ref={menuButtonRef}
            type="button"
            className="flex size-11 min-h-11 min-w-11 items-center justify-center rounded-xl text-gray transition-colors hover:bg-coral-soft hover:text-coral md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'بستن منو' : 'باز کردن منو'}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-nav"
          ref={menuRef}
          className="border-t border-border bg-white md:hidden"
          role="navigation"
          aria-label="منوی موبایل"
        >
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-sm font-medium">
            <Link
              href="/professionals"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-foreground hover:bg-gray-light"
            >
              زیباگران
            </Link>
            <Link
              href="/search"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-foreground hover:bg-gray-light"
            >
              جستجو
            </Link>
            <Link
              href="/services"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3 text-foreground hover:bg-gray-light"
            >
              خدمات
            </Link>
            {isAuthenticated ? (
              <>
                {hasRole('customer') && (
                  <Link
                    href="/panel"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-3 text-foreground hover:bg-gray-light"
                  >
                    پنل مشتری
                  </Link>
                )}
                {hasRole('professional') && (
                  <Link
                    href="/zibagar"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-3 text-coral hover:bg-coral-soft"
                  >
                    پنل زیباگر
                  </Link>
                )}
                {hasRole('SUPER_ADMIN') && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl border border-blue/30 bg-blue-soft px-3 py-3 font-bold text-blue hover:bg-blue hover:text-white"
                  >
                    <span aria-hidden>👑</span>
                    <span>پنل سوپر ادمین</span>
                  </Link>
                )}
                <button
                  type="button"
                  className="rounded-xl px-3 py-3 text-right text-coral hover:bg-coral-soft"
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                >
                  خروج
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-foreground hover:bg-gray-light"
                >
                  ورود
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="mt-1 flex h-11 min-h-11 items-center justify-center rounded-2xl bg-coral text-center font-medium text-white shadow-sm hover:bg-coral-dark"
                >
                  ثبت‌نام
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
