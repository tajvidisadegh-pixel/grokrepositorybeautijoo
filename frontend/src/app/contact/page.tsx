import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, siteName } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'تماس با پشتیبانی',
  description: `راه‌های ارتباط با پشتیبانی ${siteName()} و ارسال پیام.`,
  path: '/contact',
});

export default function ContactPage() {
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'support@beautijoo.ir';

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0B2C4A]">تماس با پشتیبانی</h1>
      <p className="text-sm text-gray-600">
        برای مشکل رزرو، پرداخت یا حساب کاربری از راه‌های زیر با ما در ارتباط باشید.
      </p>

      <section className="space-y-4 text-sm leading-7 text-gray-800">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-base font-semibold text-[#0B2C4A]">ایمیل پشتیبانی</h2>
          <a
            href={`mailto:${supportEmail}`}
            className="font-medium text-[#2D6CDF] underline"
            dir="ltr"
          >
            {supportEmail}
          </a>
          <p className="mt-2 text-xs text-gray-500">
            معمولاً ظرف ۱ تا ۲ روز کاری پاسخ داده می‌شود.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-base font-semibold text-[#0B2C4A]">از داخل پنل</h2>
          <ul className="list-disc space-y-1 pr-5">
            <li>
              مشتری:{' '}
              <Link href="/panel/notifications" className="text-[#2D6CDF] underline">
                اعلان‌ها و رزروها
              </Link>
            </li>
            <li>
              زیباگر:{' '}
              <Link href="/zibagar/support" className="text-[#2D6CDF] underline">
                پشتیبانی پنل زیباگر
              </Link>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="font-medium">قبل از پیام، این‌ها را ببینید:</p>
          <ul className="mt-2 list-disc space-y-1 pr-5 text-sm">
            <li>
              <Link href="/faq" className="underline">
                سوالات متداول
              </Link>
            </li>
            <li>
              <Link href="/refund" className="underline">
                قوانین کنسلی و بازپرداخت
              </Link>
            </li>
            <li>
              <Link href="/terms" className="underline">
                شرایط استفاده
              </Link>
            </li>
          </ul>
        </div>

        <p className="text-xs text-gray-500">
          لطفاً در پیام خود شماره موبایل ثبت‌شده، شناسه رزرو (در صورت وجود) و توضیح کوتاه مشکل را
          بنویسید تا سریع‌تر بررسی شود.
        </p>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-border pt-4 text-sm">
        <Link href="/about" className="text-[#2D6CDF] underline">
          درباره ما
        </Link>
        <Link href="/privacy" className="text-[#2D6CDF] underline">
          حریم خصوصی
        </Link>
      </div>
    </div>
  );
}
