import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'قوانین و شرایط استفاده',
  description:
    'شرایط استفاده از بیوتی‌جو برای مشتریان و زیباگران: حساب کاربری، رزرو، پرداخت و مسئولیت‌ها.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0B2C4A]">قوانین و شرایط استفاده</h1>
      <p className="text-sm text-gray-600">آخرین به‌روزرسانی: شهریور ۱۴۰۵</p>
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        این سند چارچوب کلی است و جایگزین مشاوره حقوقی نیست. پیش از انتشار عمومی بازبینی
        حقوقی توصیه می‌شود.
      </p>

      <section className="space-y-3 text-sm leading-7 text-gray-800">
        <h2 className="text-lg font-semibold text-[#0B2C4A]">۱. تعریف سرویس</h2>
        <p>
          بیوتی‌جو پلتفرم واسط برای معرفی زیباگران، نمایش خدمات و قیمت، و رزرو آنلاین است.
          ارائه خدمت زیبایی توسط خود زیباگر انجام می‌شود؛ بیوتی‌جو ارائه‌دهنده مستقیم خدمت
          زیبایی نیست مگر خلاف آن صریحاً اعلام شود.
        </p>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۲. حساب کاربری</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>کاربر مسئول صحت اطلاعات ثبت‌شده و حفظ امنیت دسترسی به حساب است.</li>
          <li>استفاده از شماره موبایل دیگران بدون اجازه ممنوع است.</li>
          <li>
            حساب‌های متخلف ممکن است محدود یا مسدود شوند (مثلاً سوءاستفاده، تقلب، محتوای
            نامناسب).
          </li>
        </ul>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۳. زیباگران</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>
            پروفایل و خدمات باید واقعی باشد. قیمت و مدت اعلام‌شده مبنای رزرو است مگر توافق
            جداگانه.
          </li>
          <li>
            وضعیت «تأییدشده» فقط در صورت وجود فرآیند بررسی در سیستم نمایش داده می‌شود و به
            معنای تضمین کیفیت مطلق نیست.
          </li>
          <li>زیباگر مسئول رعایت قوانین صنفی و بهداشتی محل فعالیت خود است.</li>
        </ul>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۴. رزرو و پرداخت</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>رزرو تا تأیید نهایی پرداخت/وضعیت سرور قطعی محسوب نمی‌شود.</li>
          <li>مبالغ از طریق درگاه‌های پیکربندی‌شده پردازش می‌شوند.</li>
          <li>لغو و بازپرداخت طبق صفحه «سیاست بازپرداخت» و قوانین زمانی پلتفرم است.</li>
        </ul>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۵. نظرات و محتوا</h2>
        <p>
          نظرات باید تجربه واقعی کاربر باشند. محتوای توهین‌آمیز، جعلی یا مغایر قوانین قابل
          حذف است.
        </p>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۶. محدودیت مسئولیت</h2>
        <p>
          بیوتی‌جو برای اختلافات ناشی از کیفیت خدمت حضوری، تأخیر طرفین، یا خسارات غیرمستقیم
          در حد مجاز قانون مسئولیتی ندارد؛ در حد امکان میانجی‌گری پشتیبانی فراهم می‌شود.
        </p>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۷. تغییر شرایط</h2>
        <p>
          ممکن است این متن به‌روزرسانی شود. نسخهٔ منتشرشده در همین صفحه مبنای جاری است.
        </p>
      </section>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/privacy" className="text-[#2D6CDF] underline">
          حریم خصوصی
        </Link>
        <Link href="/refund" className="text-[#2D6CDF] underline">
          بازپرداخت
        </Link>
      </div>
    </div>
  );
}
