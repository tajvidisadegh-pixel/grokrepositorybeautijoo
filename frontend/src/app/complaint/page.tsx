import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, siteName } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'ثبت شکایت',
  description: `مسیر شکایت و پیگیری در ${siteName()}`,
  path: '/complaint',
});

export default function ComplaintPage() {
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@beautijoo.ir';
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0B2C4A]">ثبت شکایت و پیگیری</h1>
      <p className="text-sm text-gray-600">
        اگر از کیفیت خدمت، رزرو، پرداخت یا رفتار طرف مقابل ناراضی هستید، از این مسیر پیگیری کنید.
      </p>
      <ol className="list-decimal space-y-3 pr-5 text-sm leading-7 text-gray-800">
        <li>
          ابتدا از <Link href="/panel/bookings" className="text-coral underline">رزروهای من</Link>{' '}
          وضعیت نوبت و پرداخت را بررسی کنید.
        </li>
        <li>
          موضوع را با ذکر <strong>کد رزرو</strong>، تاریخ و شرح کوتاه به ایمیل پشتیبانی ارسال کنید:{' '}
          <a href={`mailto:${support}?subject=${encodeURIComponent('شکایت / پیگیری رزرو')}`} className="text-coral underline" dir="ltr">
            {support}
          </a>
        </li>
        <li>پاسخ اولیه معمولاً ظرف ۱ تا ۳ روز کاری ارسال می‌شود.</li>
        <li>
          برای قطع سرویس یا وضعیت سامانه: <Link href="/status" className="text-coral underline">/status</Link>
        </li>
      </ol>
      <div className="rounded-2xl border border-border bg-gray-light/40 px-4 py-3 text-xs text-gray">
        شکایت‌های مرتبط با ایمنی یا تخلف جدی در اولویت بررسی ادمین قرار می‌گیرند و در لاگ audit ثبت می‌شوند.
      </div>
      <Link href="/contact" className="inline-block text-sm text-blue underline">
        فرم تماس عمومی
      </Link>
    </div>
  );
}
