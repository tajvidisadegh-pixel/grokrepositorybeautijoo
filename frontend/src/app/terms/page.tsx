import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'قوانین و شرایط | بیوتی‌جو',
  description: 'قوانین استفاده از بیوتی‌جو',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0B2C4A]">قوانین و شرایط استفاده</h1>
      <p className="text-sm text-gray-600">آخرین به‌روزرسانی: شهریور ۱۴۰۵</p>
      <section className="space-y-3 text-sm leading-7 text-gray-800">
        <p>با استفاده از بیوتی‌جو، این شرایط را می‌پذیرید.</p>
        <h2 className="text-lg font-semibold">۱. خدمات</h2>
        <p>بیوتی‌جو یک پلتفرم واسط برای رزرو خدمات زیبایی بین مشتری و زیباگر است و خود ارائه‌دهنده مستقیم خدمت نیست.</p>
        <h2 className="text-lg font-semibold">۲. حساب کاربری</h2>
        <p>مسئولیت حفظ امنیت شماره موبایل و کد OTP با کاربر است. اطلاعات نادرست یا سوءاستفاده می‌تواند منجر به تعلیق حساب شود.</p>
        <h2 className="text-lg font-semibold">۳. رزرو و پرداخت</h2>
        <p>جزئیات لغو و بازپرداخت در <Link href="/refund" className="text-[#2D6CDF] underline">سیاست بازپرداخت</Link> آمده است.</p>
        <h2 className="text-lg font-semibold">۴. محتوای کاربر</h2>
        <p>نظرات و تصاویر نباید توهین‌آمیز، غیرقانونی یا ناقض حقوق دیگران باشد. سوپرادمین می‌تواند محتوای نامناسب را حذف کند.</p>
        <h2 className="text-lg font-semibold">۵. محدودیت مسئولیت</h2>
        <p>بیوتی‌جو مسئول کیفیت نهایی خدمت حضوری زیباگر نیست؛ در صورت اختلاف، پشتیبانی تلاش می‌کند میانجی‌گری کند.</p>
      </section>
      <Link href="/" className="text-sm text-[#2D6CDF] underline">بازگشت به صفحه اصلی</Link>
    </div>
  );
}
