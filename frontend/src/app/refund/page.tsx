import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'سیاست بازپرداخت | بیوتی‌جو',
  description: 'شرایط لغو و بازپرداخت بیوتی‌جو',
};

export default function RefundPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0B2C4A]">سیاست بازپرداخت و لغو</h1>
      <section className="space-y-3 text-sm leading-7 text-gray-800">
        <p>
          لغو رزرو و بازپرداخت بسته به زمان لغو و وضعیت پرداخت ممکن است متفاوت باشد.
          در صورت مشکل، از پنل مشتری/زیباگر یا پشتیبانی اقدام کنید.
        </p>
        <ul className="list-disc pr-5 space-y-1">
          <li>لغو توسط مشتری قبل از موعد: طبق قوانین رزرو همان زیباگر و وضعیت پرداخت بررسی می‌شود.</li>
          <li>لغو توسط زیباگر: مشتری مطلع می‌شود و در صورت پرداخت، مسیر بازپرداخت پیگیری می‌شود.</li>
          <li>اختلافات: سوپرادمین می‌تواند با ثبت دلیل، وضعیت رزرو را اصلاح کند (با Audit Log).</li>
        </ul>
        <p>این متن چارچوب کلی است و جایگزین قوانین خاص هر زیباگر برای زمان لغو نمی‌شود.</p>
      </section>
      <Link href="/terms" className="text-sm text-[#2D6CDF] underline">قوانین و شرایط</Link>
    </div>
  );
}
