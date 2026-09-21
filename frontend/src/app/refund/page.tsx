import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'سیاست بازپرداخت و لغو',
  description:
    'شرایط لغو رزرو و بازپرداخت در بیوتی‌جو برای مشتری و زیباگر؛ هم‌راستا با وضعیت پرداخت در پنل.',
  path: '/refund',
});

export default function RefundPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0B2C4A]">سیاست بازپرداخت و لغو</h1>
      <p className="text-sm text-gray-600">آخرین به‌روزرسانی: شهریور ۱۴۰۵</p>
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        جزئیات نهایی به پیکربندی درگاه و قوانین زمانی سرور بستگی دارد. این متن راهنمای کلی
        کاربر است.
      </p>

      <section className="space-y-3 text-sm leading-7 text-gray-800">
        <h2 className="text-lg font-semibold text-[#0B2C4A]">۱. لغو توسط مشتری</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>
            رزروهای در وضعیت در انتظار یا تأییدشده، تا سقف زمانی اعلام‌شده در سیستم (مثلاً
            چند ساعت قبل از نوبت) از پنل مشتری قابل لغو هستند.
          </li>
          <li>
            اگر پرداخت موفق ثبت شده باشد، پس از لغو مجاز، درخواست استرداد از مسیر درگاه /
            پشتیبانی پیگیری می‌شود و وضعیت «مسترد شده» در پنل قابل مشاهده است.
          </li>
          <li>
            نزدیک به زمان نوبت، لغو ممکن است محدود شود؛ در این حالت با پشتیبانی یا زیباگر
            هماهنگ کنید.
          </li>
        </ul>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۲. لغو توسط زیباگر</h2>
        <p>
          در صورت لغو از سوی زیباگر، مشتری مطلع می‌شود و در صورت پرداخت موفق، مسیر بازپرداخت
          فعال می‌شود.
        </p>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۳. وضعیت‌های پرداخت مرتبط</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>
            <strong>موفق:</strong> مبلغ دریافت شده؛ لغو منجر به فرآیند استرداد می‌شود.
          </li>
          <li>
            <strong>مسترد شده:</strong> استرداد در سیستم ثبت شده است (زمان واریز به حساب
            بانکی به درگاه بستگی دارد).
          </li>
          <li>
            <strong>در انتظار / ناموفق:</strong> ممکن است فقط لغو رزرو کافی باشد و مبلغی
            برای استرداد وجود نداشته باشد.
          </li>
        </ul>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۴. اختلافات</h2>
        <p>
          در موارد خاص، پشتیبانی/مدیر سیستم می‌تواند با ثبت دلیل، وضعیت رزرو یا پرداخت را
          اصلاح کند. اتصال و تسویه نهایی درگاه خارج از کنترل کامل پلتفرم است.
        </p>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">۵. محل پیگیری</h2>
        <p>
          از مسیر <Link href="/panel/bookings" className="text-[#2D6CDF] underline">رزروهای من</Link>{' '}
          وضعیت رزرو و پرداخت را ببینید و در صورت امکان لغو را همان‌جا ثبت کنید.
        </p>
      </section>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/terms" className="text-[#2D6CDF] underline">
          قوانین و شرایط
        </Link>
        <Link href="/privacy" className="text-[#2D6CDF] underline">
          حریم خصوصی
        </Link>
      </div>
    </div>
  );
}
