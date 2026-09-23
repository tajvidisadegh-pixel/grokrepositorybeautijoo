'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { ApiError } from '@/lib/api';
import { authApi } from '@/lib/auth-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { LogoMark } from '@/components/brand/logo';
import type { AccountType } from '@/types/auth';

type Step = 'phone' | 'code' | 'done';

function ForgotPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const asParam = search?.get('as');
  const [accountType, setAccountType] = useState<AccountType>(
    asParam === 'professional' ? 'professional' : 'customer',
  );
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (!/^09\d{9}$/.test(phone.trim())) {
      setError('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({
        phone: phone.trim(),
        accountType,
      });
      setExpiresIn(res.expiresIn);
      setMsg(res.message);
      setStep('code');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'ارسال کد ممکن نشد. دوباره تلاش کنید.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (!code.trim()) {
      setError('کد تأیید را وارد کنید');
      return;
    }
    if (newPassword.length < 8) {
      setError('رمز جدید باید حداقل ۸ کاراکتر باشد');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('تکرار رمز با رمز جدید یکسان نیست');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.resetPassword({
        phone: phone.trim(),
        code: code.trim(),
        newPassword,
        accountType,
      });
      setMsg(res.message);
      setStep('done');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'بازنشانی رمز ناموفق بود. دوباره تلاش کنید.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12" dir="rtl">
      <div className="flex flex-col items-center gap-2 text-center">
        <LogoMark className="h-12 w-12" />
        <h1 className="text-2xl font-bold text-foreground">فراموشی رمز عبور</h1>
        <p className="text-sm text-gray">
          {step === 'phone' && 'شماره موبایل حساب خود را وارد کنید'}
          {step === 'code' && 'کد پیامک‌شده و رمز جدید را وارد کنید'}
          {step === 'done' && 'رمز با موفقیت تغییر کرد'}
        </p>
      </div>

      <Card className="p-6">
        {step === 'phone' && (
          <form onSubmit={onRequest} className="space-y-4">
            <div className="mb-2 flex gap-2 rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setAccountType('customer')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  accountType === 'customer'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-gray hover:text-foreground'
                }`}
              >
                مشتری
              </button>
              <button
                type="button"
                onClick={() => setAccountType('professional')}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  accountType === 'professional'
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-gray hover:text-foreground'
                }`}
              >
                زیباگر
              </button>
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
              ارسال کد تأیید
            </Button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={onReset} className="space-y-4">
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
                autoComplete="one-time-code"
              />
              {expiresIn != null && (
                <p className="mt-1 text-xs text-gray">اعتبار کد: حدود {Math.ceil(expiresIn / 60)} دقیقه</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">رمز جدید</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'مخفی' : 'نمایش'}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">تکرار رمز جدید</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {msg && (
              <p className="rounded-xl bg-blue/10 px-3 py-2 text-sm text-blue">{msg}</p>
            )}
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              ذخیره رمز جدید
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-gray underline"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
                setMsg(null);
              }}
            >
              تغییر شماره موبایل
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center">
            <p className="rounded-xl bg-blue/10 px-3 py-3 text-sm text-blue">
              {msg || 'رمز عبور با موفقیت تغییر کرد.'}
            </p>
            <Button
              className="w-full"
              onClick={() => router.push(`/login?as=${accountType}`)}
            >
              ورود با رمز جدید
            </Button>
          </div>
        )}

        <div className="mt-6 border-t border-border pt-4 text-center text-sm text-gray">
          <Link
            href={`/login?as=${accountType}`}
            className="font-medium text-coral hover:text-coral-dark"
          >
            بازگشت به ورود
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-gray">
          در حال بارگذاری...
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
