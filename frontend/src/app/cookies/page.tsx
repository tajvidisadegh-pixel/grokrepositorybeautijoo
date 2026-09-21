import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'سیاست کوکی',
  description:
    'نحوه استفاده بیوتی‌جو از کوکی‌ها و ذخیره‌سازی محلی برای ورود امن و عملکرد سایت.',
  path: '/cookies',
});

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0B2C4A]">سیاست کوکی</h1>
      <p className="text-sm text-gray-600">آخرین به‌روزرسانی: شهریور ۱۴۰۵</p>

      <section className="space-y-3 text-sm leading-7 text-gray-800">
        <p>
          بیوتی‌جو عمدتاً از کوکی‌ها و ذخیره‌سازی محلی <strong>ضروری</strong> برای ورود امن
          و حفظ نشست استفاده می‌کند (مثلاً توکن دسترسی/رفرش یا پرچم نشست).
        </p>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">انواع ذخیره‌سازی</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>
            <strong>ضروری:</strong> احراز هویت، امنیت و جلوگیری از CSRF — بدون این‌ها ورود
            و رزرو امن کار نمی‌کند.
          </li>
          <li>
            <strong>عملکردی (در صورت فعال بودن):</strong> ترجیحات ساده رابط کاربری.
          </li>
          <li>
            <strong>آمار غیرضروری:</strong> در حال حاضر به‌صورت پیش‌فرض ردیابی تبلیغاتی
            شخص ثالث فعال نیست. در صورت افزودن آنالیتیکس غیرضروری، رضایت صریح گرفته می‌شود.
          </li>
        </ul>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">مدیریت در مرورگر</h2>
        <p>
          می‌توانید از تنظیمات مرورگر کوکی‌ها را پاک یا مسدود کنید؛ در آن صورت ورود و برخی
          قابلیت‌ها ممکن است مختل شود.
        </p>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">اطلاعات بیشتر</h2>
        <p>
          جزئیات پردازش داده در{' '}
          <Link href="/privacy" className="text-[#2D6CDF] underline">
            سیاست حریم خصوصی
          </Link>{' '}
          آمده است.
        </p>
      </section>
    </div>
  );
}
