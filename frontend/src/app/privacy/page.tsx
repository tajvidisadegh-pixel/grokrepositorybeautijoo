import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'حریم خصوصی',
  description:
    'سیاست حریم خصوصی بیوتی‌جو: چه داده‌هایی جمع‌آوری می‌شود، چرا، و چگونه محافظت می‌شود.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0B2C4A]">سیاست حریم خصوصی</h1>
      <p className="text-sm text-gray-600">آخرین به‌روزرسانی: شهریور ۱۴۰۵</p>
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        این متن چارچوب کلی محصول است و جایگزین مشاوره حقوقی تخصصی برای کسب‌وکار شما
        نیست. قبل از راه‌اندازی عمومی، با مشاور حقوقی بازبینی کنید.
      </p>

      <section className="space-y-3 text-sm leading-7 text-gray-800">
        <p>
          بیوتی‌جو («ما») پلتفرمی برای پیدا کردن زیباگر، مشاهده خدمات و قیمت، و رزرو آنلاین
          است. ما متعهدیم داده‌های شخصی کاربران را شفاف و امن پردازش کنیم.
        </p>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۱. چه داده‌هایی جمع‌آوری می‌شود؟</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>
            <strong>هویت و تماس:</strong> شماره موبایل، نام نمایشی، و در صورت ارائه ایمیل.
          </li>
          <li>
            <strong>حساب کاربری:</strong> نقش (مشتری / زیباگر)، وضعیت حساب، تنظیمات اعلان.
          </li>
          <li>
            <strong>رزرو و پرداخت:</strong> جزئیات نوبت، مبلغ، وضعیت پرداخت و شناسه‌های درگاه
            (نه شماره کارت کامل).
          </li>
          <li>
            <strong>پروفایل زیباگر:</strong> عنوان، بیو، خدمات، قیمت، محل فعالیت، ساعات کاری،
            نمونه کار.
          </li>
          <li>
            <strong>فنی و امنیتی:</strong> لاگ‌های خطا، شناسه نشست، آدرس IP تقریبی برای امنیت
            و جلوگیری از سوءاستفاده.
          </li>
        </ul>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۲. هدف از پردازش</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>ایجاد و مدیریت حساب، ورود امن (از جمله OTP).</li>
          <li>انجام رزرو، هماهنگی با زیباگر، و پیگیری وضعیت پرداخت/استرداد.</li>
          <li>ارسال اعلان‌های ضروری مربوط به رزرو (in-app و در صورت فعال بودن SMS).</li>
          <li>بهبود امنیت، جلوگیری از تقلب، و پشتیبانی کاربران.</li>
          <li>انطباق با الزامات قانونی در صورت درخواست مراجع صالح.</li>
        </ul>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۳. اشتراک‌گذاری با اشخاص ثالث</h2>
        <p>
          داده‌ها فقط در حد لازم با ارائه‌دهندگان زیرساخت (میزبانی، پیامک، درگاه پرداخت) به
          اشتراک گذاشته می‌شود. ما داده‌های شخصی را برای تبلیغات شخص ثالث نمی‌فروشیم.
        </p>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۴. نگهداری و امنیت</h2>
        <p>
          دسترسی به داده‌ها محدود به نقش‌های مجاز است. رمز عبور در صورت وجود به‌صورت hash
          ذخیره می‌شود. نشست‌ها قابل خروج از راه دور هستند. مدت نگهداری متناسب با نیاز
          عملیاتی و الزامات قانونی است.
        </p>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۵. حقوق شما</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>مشاهده و به‌روزرسانی اطلاعات پروفایل از پنل کاربری.</li>
          <li>درخواست حذف یا غیرفعال‌سازی حساب (با سیاست حفظ داده رزروهای گذشته).</li>
          <li>مدیریت نشست‌ها و خروج از دستگاه‌های دیگر.</li>
        </ul>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۶. تماس</h2>
        <p>
          برای پرسش درباره حریم خصوصی از بخش پشتیبانی داخل پنل یا کانال‌های رسمی اعلام‌شده
          در سایت استفاده کنید.
        </p>
      </section>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/terms" className="text-[#2D6CDF] underline">
          قوانین و شرایط
        </Link>
        <Link href="/cookies" className="text-[#2D6CDF] underline">
          سیاست کوکی
        </Link>
        <Link href="/refund" className="text-[#2D6CDF] underline">
          بازپرداخت
        </Link>
      </div>
    </div>
  );
}
