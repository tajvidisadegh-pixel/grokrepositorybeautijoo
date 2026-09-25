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

type RegisterRole = 'customer' | 'professional';
type Step = 'phone' | 'code' | 'details';

function RegisterForm() {
  const { register, requestOtp, isAuthenticated, hasRole } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const asParam = search?.get('as');

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<RegisterRole>(
    asParam === 'professional' ? 'professional' : 'customer',
  );
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (isAuthenticated) {
    if (hasRole('professional')) {
      router.replace('/zibagar/profile/complete');
    } else {
      router.replace('/panel');
    }
  }

  async function sendOtp() {
    setError(null);
    setInfo(null);
    if (!/^09\d{9}$/.test(phone.trim())) {
      setError('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد');
      return false;
    }
    setLoading(true);
    try {
      const res = await requestOtp(phone.trim(), 'register', role);
      setExpiresIn(res.expiresIn);
      setCooldown(60);
      setInfo(`کد تأیید به شماره ${phone.trim()} ارسال شد.`);
      setStep('code');
      return true;
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'ارسال کد ناموفق بود. دوباره تلاش کنید.',
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function onPhoneSubmit(e: FormEvent) {
    e.preventDefault();
    await sendOtp();
  }

  async function onCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.trim().length < 4) {
      setError('کد تأیید را وارد کنید');
      return;
    }
    setStep('details');
    setInfo(null);
  }

  async function onDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('رمز عبور حداقل ۸ کاراکتر باشد');
      return;
    }
    setLoading(true);
    try {
      const me = await register(
        phone.trim(),
        password,
        code.trim(),
        displayName.trim() || undefined,
        role,
      );
      const isPro = me.roles?.includes('professional') ?? false;
      router.replace(isPro ? '/zibagar/profile/complete' : '/panel');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'ثبت‌نام ناموفق بود. دوباره تلاش کنید.';
      setError(msg);
      if (msg.includes('کد') || msg.includes('منقضی') || msg.includes('تلاش')) {
        setStep('code');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="text-center">
        <LogoMark className="mx-auto mb-4 size-14" />
        <h1 className="text-xl font-bold text-coral sm:text-2xl">ثبت‌نام در بیوتی‌جو</h1>
        <p className="mt-2 text-sm text-gray">
          {step === 'phone' && 'شماره موبایل خود را وارد کنید'}
          {step === 'code' && `کد تأیید ارسال‌شده به ${phone} را وارد کنید`}
          {step === 'details' && 'رمز عبور و نام نمایشی را تکمیل کنید'}
        </p>
      </div>

      <Card>
        {step === 'phone' && (
          <form onSubmit={onPhoneSubmit} className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">ثبت‌نام به‌عنوان</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('customer')}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    role === 'customer'
                      ? 'border-coral bg-coral-soft text-coral'
                      : 'border-border text-gray hover:bg-gray-light'
                  }`}
                >
                  مشتری
                </button>
                <button
                  type="button"
                  onClick={() => setRole('professional')}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                    role === 'professional'
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
                autoComplete="tel"
              />
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              دریافت کد تأیید
            </Button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={onCodeSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">کد تأیید</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="۶ رقم"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required
                dir="ltr"
                className="text-left tracking-widest"
                autoFocus
                maxLength={8}
              />
              {expiresIn !== null && (
                <p className="mt-1 text-xs text-gray">
                  اعتبار کد: حدود {Math.round(expiresIn / 60)} دقیقه
                </p>
              )}
            </div>
            {info && (
              <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">{info}</p>
            )}
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              ادامه
            </Button>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={cooldown > 0 || loading}
                onClick={() => void sendOtp()}
              >
                {cooldown > 0 ? `ارسال مجدد (${cooldown})` : 'ارسال مجدد کد'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep('phone');
                  setCode('');
                  setError(null);
                  setInfo(null);
                }}
              >
                تغییر شماره
              </Button>
            </div>
          </form>
        )}

        {step === 'details' && (
          <form onSubmit={onDetailsSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">نام نمایشی</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={
                  role === 'professional' ? 'مثلاً متخصص پوست و مو' : 'مثلاً مریم رضایی'
                }
                autoComplete="name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">رمز عبور</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="حداقل ۸ کاراکتر"
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-gray">
              شماره: <span dir="ltr">{phone}</span>
            </p>
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              {role === 'professional' ? 'تکمیل ثبت‌نام زیباگر' : 'تکمیل ثبت‌نام'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep('code');
                setError(null);
              }}
            >
              بازگشت به کد تأیید
            </Button>
          </form>
        )}

        <div className="mt-6 border-t border-border pt-4 text-center text-sm text-gray">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <Link href={`/login?as=${role}`} className="font-medium text-coral hover:text-coral-dark">
            ورود
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-gray">
          در حال بارگذاری...
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
