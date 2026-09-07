'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

function LoginForm() {
  const { loginWithPassword, isAuthenticated, hasRole } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const nextParam = search?.get('next');

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    let dest = nextParam || '/panel';
    if (hasRole('SUPER_ADMIN')) dest = '/admin';
    else if (hasRole('professional') && !hasRole('customer')) dest = '/zibagar';
    else dest = nextParam || '/panel';
    if (dest.startsWith('/panel') && hasRole('professional') && !hasRole('customer')) dest = '/zibagar';
    router.replace(dest);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginWithPassword(phone.trim(), password);
      let dest = nextParam || '/panel';
      const roles: string[] = [];
      try {
        const { getAccessToken } = await import('@/lib/auth-storage');
        const { authApi } = await import('@/lib/auth-api');
        const token = getAccessToken();
        if (token) {
          const me = await authApi.me(token);
          const r = me.roles || [];
          roles.push(...r);
        }
      } catch {
        /* ignore */
      }
      if (roles.includes('SUPER_ADMIN')) dest = '/admin';
      else if (roles.includes('professional') && !roles.includes('customer')) dest = '/zibagar';
      else dest = nextParam || '/panel';
      if (dest.startsWith('/panel') && roles.includes('professional') && !roles.includes('customer')) {
        dest = '/zibagar';
      }
      if (dest.startsWith('/zibagar') && roles.includes('customer') && !roles.includes('professional')) {
        dest = '/panel';
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
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-blue-soft/80 to-white">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 py-10 sm:gap-6 sm:py-14">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-coral to-coral-dark text-lg font-bold text-white shadow-sm">
            ب
          </div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">ورود به Beautijoo</h1>
          <p className="mt-2 text-sm text-gray">ورود به حساب کاربری با شماره موبایل و رمز عبور</p>
        </div>

        <Card>
          <form onSubmit={onSubmit} className="space-y-4">
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
              ورود با رمز عبور
            </Button>
          </form>

          <div className="mt-6 space-y-2 border-t border-border pt-4 text-center text-sm text-gray">
            <p>
              ورود با کد یک‌بارمصرف؟{' '}
              <Link href="/otp" className="font-medium text-coral hover:text-coral-dark">
                ورود با OTP
              </Link>
            </p>
            <p>
              حساب ندارید؟{' '}
              <Link href="/register" className="font-medium text-coral hover:text-coral-dark">
                ثبت‌نام
              </Link>
            </p>
          </div>
        </Card>
      </div>
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
