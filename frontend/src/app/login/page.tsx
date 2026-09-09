'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import type { AccountType } from '@/types/auth';

function LoginForm() {
  const { loginWithPassword, isAuthenticated, hasRole, user } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const nextParam = search?.get('next');
  const asParam = search?.get('as');

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<AccountType>(
    asParam === 'professional' ? 'professional' : 'customer',
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    let dest = nextParam || '/panel';
    if (hasRole('SUPER_ADMIN') || hasRole('admin')) dest = '/admin';
    else if (user?.accountType === 'professional' || hasRole('professional')) dest = '/zibagar';
    else dest = nextParam || '/panel';
    if (dest.startsWith('/panel') && (user?.accountType === 'professional' || (hasRole('professional') && !hasRole('customer')))) {
      dest = '/zibagar';
    }
    if (dest.startsWith('/zibagar') && user?.accountType === 'customer') {
      dest = '/panel';
    }
    router.replace(dest);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginWithPassword(phone.trim(), password, accountType);
      let dest = nextParam || (accountType === 'professional' ? '/zibagar' : '/panel');
      try {
        const { getAccessToken } = await import('@/lib/auth-storage');
        const { authApi } = await import('@/lib/auth-api');
        const token = getAccessToken();
        if (token) {
          const me = await authApi.me(token);
          const roles = me.roles || [];
          if (roles.includes('SUPER_ADMIN') || roles.includes('admin')) dest = '/admin';
          else if (me.accountType === 'professional' || roles.includes('professional')) {
            dest = nextParam?.startsWith('/zibagar') ? nextParam : '/zibagar';
          } else {
            dest = nextParam?.startsWith('/panel') ? nextParam : '/panel';
          }
        }
      } catch {
        dest = accountType === 'professional' ? '/zibagar' : '/panel';
      }
      router.replace(dest);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'ورود ناموفق بود. دوباره تلاش کنید.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-coral to-coral-dark text-lg font-bold text-white shadow-sm">
          ب
        </div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">ورود به Beautijoo</h1>
        <p className="mt-2 text-sm text-gray">ورود به حساب کاربری با شماره موبایل و رمز عبور</p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">ورود به‌عنوان</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccountType('customer')}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                  accountType === 'customer'
                    ? 'border-coral bg-coral-soft text-coral'
                    : 'border-border text-gray hover:bg-gray-light'
                }`}
              >
                مشتری
              </button>
              <button
                type="button"
                onClick={() => setAccountType('professional')}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                  accountType === 'professional'
                    ? 'border-coral bg-coral-soft text-coral'
                    : 'border-border text-gray hover:bg-gray-light'
                }`}
              >
                زیباگر
              </button>
            </div>
            <p className="mt-2 text-xs text-gray">
              حساب مشتری و زیباگر حتی با یک شماره کاملاً جدا هستند و هم‌زمان در یک نشست در دسترس نیستند.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">شماره موبایل</label>
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="09123456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
              className="text-left"
              autoComplete="tel"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">رمز عبور</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={loading}>
            {accountType === 'professional' ? 'ورود به پنل زیباگر' : 'ورود به پنل مشتری'}
          </Button>
        </form>

        <div className="mt-6 space-y-2 border-t border-border pt-4 text-center text-sm text-gray">
          <p>
            ورود با کد یک‌بارمصرف؟{' '}
            <Link
              href={`/otp?as=${accountType}`}
              className="font-medium text-coral hover:text-coral-dark"
            >
              ورود با OTP
            </Link>
          </p>
          <p>
            حساب ندارید؟{' '}
            <Link
              href={`/register?as=${accountType}`}
              className="font-medium text-coral hover:text-coral-dark"
            >
              ثبت‌نام
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-gray">
          در حال بارگذاری...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
