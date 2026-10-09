'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { LogoMark } from '@/components/brand/logo';
import type { AccountType } from '@/types/auth';

/**
 * OTP page — supports login/register and phone verification before booking (#40 item 25).
 * When user is authenticated but phoneVerified=false (reason=booking), stay on page and verify.
 */
function OtpForm() {
  const { requestOtp, verifyOtp, isAuthenticated, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const asParam = search?.get('as');
  const reason = search?.get('reason') || '';
  const nextDefault = asParam === 'professional' ? '/zibagar' : '/panel';
  const next = search?.get('next') || nextDefault;

  const needsPhoneVerify =
    isAuthenticated && user != null && user.phoneVerified === false;

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [accountType, setAccountType] = useState<AccountType>(
    asParam === 'professional' ? 'professional' : 'customer',
  );
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefill phone for logged-in users verifying before booking
  useEffect(() => {
    if (user?.phone && /^09\d{9}$/.test(user.phone)) {
      setPhone(user.phone);
    }
    if (user?.accountType === 'professional') {
      setAccountType('professional');
    } else if (user?.accountType === 'customer') {
      setAccountType('customer');
    }
  }, [user?.phone, user?.accountType]);

  // Only bounce away when already verified (or no need to verify)
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated && user && user.phoneVerified !== false && !needsPhoneVerify) {
      const dest =
        user.accountType === 'professional' || (user.roles || []).includes('professional')
          ? '/zibagar'
          : next.startsWith('/zibagar')
            ? '/panel'
            : next;
      router.replace(dest);
    }
  }, [authLoading, isAuthenticated, user, needsPhoneVerify, next, router]);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^09\d{9}$/.test(phone.trim())) {
      setError('شماره موبایل معتبر نیست (۰۹xxxxxxxxx)');
      return;
    }
    setLoading(true);
    try {
      // purpose login works for existing users and sets phoneVerified on success
      const res = await requestOtp(phone.trim(), 'login', accountType);
      setExpiresIn(res.expiresIn);
      setStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ارسال کد ناموفق بود');
    } finally {
      setLoading(false);
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(phone.trim(), code.trim(), 'login', accountType);
      // Prefer return path (e.g. booking wizard) over hard-coded panel
      const dest =
        next && next.startsWith('/') && !next.startsWith('//')
          ? next
          : accountType === 'professional'
            ? '/zibagar'
            : '/panel';
      router.replace(dest);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تأیید کد ناموفق بود');
    } finally {
      setLoading(false);
    }
  }

  const title =
    reason === 'booking' || needsPhoneVerify
      ? 'تأیید موبایل برای رزرو'
      : 'ورود با کد یکبارمصرف';

  const subtitle =
    reason === 'booking' || needsPhoneVerify
      ? 'برای ثبت رزرو باید شماره موبایل خود را با کد پیامکی تأیید کنید.'
      : 'کد تأیید به شماره موبایل شما ارسال می‌شود.';

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10" dir="rtl">
      <Link href="/" className="mb-6">
        <LogoMark className="h-10 w-10" />
      </Link>
      <Card className="w-full max-w-md space-y-4 p-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-blue">{title}</h1>
          <p className="mt-1 text-sm text-gray">{subtitle}</p>
        </div>

        {(reason === 'booking' || needsPhoneVerify) && (
          <div
            className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
            role="status"
          >
            بعد از تأیید، به صفحه رزرو برمی‌گردید و می‌توانید ادامه دهید.
          </div>
        )}

        {!needsPhoneVerify && (
          <div className="flex gap-2 rounded-2xl bg-gray-light p-1 text-sm">
            <button
              type="button"
              className={`flex-1 rounded-xl py-2 font-medium ${
                accountType === 'customer' ? 'bg-white shadow text-coral' : 'text-gray'
              }`}
              onClick={() => setAccountType('customer')}
            >
              مشتری
            </button>
            <button
              type="button"
              className={`flex-1 rounded-xl py-2 font-medium ${
                accountType === 'professional' ? 'bg-white shadow text-coral' : 'text-gray'
              }`}
              onClick={() => setAccountType('professional')}
            >
              زیباگر
            </button>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={onRequest} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">شماره موبایل</label>
              <Input
                type="tel"
                inputMode="numeric"
                placeholder="09123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                dir="ltr"
                className="text-left"
                readOnly={needsPhoneVerify && !!user?.phone}
              />
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              دریافت کد
            </Button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">کد تأیید</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                dir="ltr"
                className="text-left tracking-widest"
                autoFocus
              />
              {expiresIn !== null && (
                <p className="mt-1 text-xs text-gray">
                  اعتبار کد: حدود {Math.round(expiresIn / 60)} دقیقه
                </p>
              )}
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              تأیید
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
            >
              تغییر شماره
            </Button>
          </form>
        )}

        <div className="mt-6 space-y-2 border-t border-border pt-4 text-center text-sm text-gray">
          <p>
            <Link
              href={`/forgot-password?as=${accountType}`}
              className="font-medium text-coral hover:text-coral-dark"
            >
              رمز عبورم را فراموش کرده‌ام
            </Link>
          </p>
          <p>
          ورود با رمز عبور؟{' '}
          <Link
            href={`/login?as=${accountType}${next ? `&next=${encodeURIComponent(next)}` : ''}`}
            className="font-medium text-coral hover:text-coral-dark"
          >
            صفحه ورود
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function OtpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-gray">
          در حال بارگذاری...
        </div>
      }
    >
      <OtpForm />
    </Suspense>
  );
}
