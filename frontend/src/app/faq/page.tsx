import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, siteName } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'سوالات متداول',
  description: `پاسخ سوالات پرتکرار درباره رزرو، پرداخت و پنل در ${siteName()}.`,
  path: '/faq',
});

const FAQS: { q: string; a: string }[] = [
  {
    q: 'چطور نوبت رزرو کنم؟',
    a: 'از صفحه جستجو یا پروفایل زیباگر، خدمت و زمان آزاد را انتخاب کنید و مراحل رزرو را تا تأیید نهایی ادامه دهید.',
  },
  {
    q: 'آیا می‌توانم رزرو را کنسل کنم؟',
    a: 'بله؛ تا قبل از موعد مشخص (معمولاً چند ساعت قبل از نوبت) امکان لغو از پنل مشتری وجود دارد. جزئیات در صفحه بازپرداخت آمده است.',
  },
  {
    q: 'اگر زیباگر نوبت را لغو کند چه می‌شود؟',
    a: 'به شما اطلاع داده می‌شود و در صورت پرداخت، طبق سیاست بازپرداخت پیگیری می‌شود.',
  },
  {
    q: 'چطور نظر ثبت کنم؟',
    a: 'پس از تکمیل نوبت، از پنل رزروها یا لینک اعلان می‌توانید امتیاز و نظر بدهید.',
  },
  {
    q: 'چطور زیباگر شوم؟',
    a: 'ثبت‌نام کنید، نقش زیباگر را فعال کنید و پروفایل، خدمات و ساعات کاری را تکمیل کنید تا برای انتشار بررسی شود.',
  },
  {
    q: 'یادآوری نوبت چطور است؟',
    a: 'اعلان داخل پنل (و در صورت فعال بودن، پیامک) نزدیک به زمان نوبت ارسال می‌شود.',
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0B2C4A]">سوالات متداول</h1>
      <p className="text-sm text-gray-600">پاسخ‌های کوتاه برای شروع سریع کار با {siteName()}</p>

      <div className="space-y-3">
        {FAQS.map((item) => (
          <details
            key={item.q}
            className="group rounded-2xl border border-border bg-white p-4 shadow-sm open:shadow-md"
          >
            <summary className="cursor-pointer list-none text-sm font-semibold text-[#0B2C4A] marker:content-none">
              <span className="flex items-center justify-between gap-2">
                {item.q}
                <span className="text-gray transition group-open:rotate-180">▾</span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-7 text-gray-700">{item.a}</p>
          </details>
        ))}
      </div>

      <p className="text-sm text-gray-700">
        پاسخ لازم را پیدا نکردید؟{' '}
        <Link href="/contact" className="text-[#2D6CDF] underline">
          با پشتیبانی تماس بگیرید
        </Link>
        .
      </p>

      <div className="flex flex-wrap gap-3 border-t border-border pt-4 text-sm">
        <Link href="/terms" className="text-[#2D6CDF] underline">
          شرایط استفاده
        </Link>
        <Link href="/refund" className="text-[#2D6CDF] underline">
          کنسلی و بازپرداخت
        </Link>
        <Link href="/about" className="text-[#2D6CDF] underline">
          درباره ما
        </Link>
      </div>
    </div>
  );
}
