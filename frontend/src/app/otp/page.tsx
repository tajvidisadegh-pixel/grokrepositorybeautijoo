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

function OtpForm() {
  const { requestOtp, verifyOtp, isAuthenticated, user } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const asParam = search?.get('as');
  const nextDefault = asParam === 'professional' ? '/zibagar' : '/panel';
  const next = search?.get('next') || nextDefault;

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [accountType, setAccountType] = useState<AccountType>(
    asParam === 'professional' ? 'professional' : 'customer',
  );
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    const dest =
      user?.accountType === 'professional' || (user?.roles || []).includes('professional')
        ? '/zibagar'
        : next.startsWith('/zibagar')
          ? '/panel'
          : next;
    router.replace(dest);
  }

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^09\d{9}$/.test(phone.trim())) {
      setError('شماره موبایل معتبر نیست (۰۹xxxxxxxxx)');
      return;
    }
    setLoading(true);
    try {
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
      router.replace(accountType === 'professional' ? '/zibagar' : '/panel');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تأیید کد ناموفق بود');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="text-center">
        <div className="logo-mark mx-auto mb-4 size-14 text-lg">B</div>
        <h1 className="text-xl font-bold text-blue sm:text-2xl">ورود با کد یک‌بارمصرف</h1>
        <p className="mt-2 text-sm text-gray">
          {step === 'phone'
            ? 'شماره موبایل و نوع حساب را انتخاب کنید'
            : `کد ارسال‌شده به ${phone} را وارد کنید`}
        </p>
      </div>

      <Card>
        {step === 'phone' ? (
          <form onSubmit={onRequest} className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">ورود به‌عنوان</p>
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
            </div>
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
              تأیید و ورود
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

        <div className="mt-6 border-t border-border pt-4 text-center text-sm text-gray">
          ورود با رمز عبور؟{' '}
          <Link
            href={`/login?as=${accountType}`}
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
