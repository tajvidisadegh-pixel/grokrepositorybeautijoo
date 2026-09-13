import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'سیاست کوکی | بیوتی‌جو',
  description: 'نحوه استفاده بیوتی‌جو از کوکی‌ها',
};

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0B2C4A]">سیاست کوکی</h1>
      <section className="space-y-3 text-sm leading-7 text-gray-800">
        <p>
          بیوتی‌جو عمدتاً از کوکی‌ها و ذخیره‌سازی محلی <strong>ضروری</strong> برای ورود امن و حفظ نشست
          استفاده می‌کند (مثلاً توکن دسترسی/رفرش یا پرچم نشست).
        </p>
        <h2 className="text-lg font-semibold">انواع</h2>
        <ul className="list-disc pr-5 space-y-1">
          <li><strong>ضروری:</strong> احراز هویت و امنیت — بدون این‌ها ورود کار نمی‌کند.</li>
          <li><strong>عملکردی (در صورت فعال بودن):</strong> ترجیحات رابط کاربری.</li>
        </ul>
        <p>
          در حال حاضر ردیابی تبلیغاتی شخص ثالث به‌صورت پیش‌فرض در محصول فعال نیست.
          در صورت افزودن آنالیتیکس غیرضروری، رضایت صریح گرفته می‌شود.
        </p>
        <p>
          می‌توانید از تنظیمات مرورگر کوکی‌ها را پاک یا مسدود کنید؛ در آن صورت ورود ممکن است مختل شود.
        </p>
      </section>
      <Link href="/privacy" className="text-sm text-[#2D6CDF] underline">حریم خصوصی</Link>
    </div>
  );
}
