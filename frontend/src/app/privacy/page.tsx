import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'حریم خصوصی | بیوتی‌جو',
  description: 'سیاست حریم خصوصی بیوتی‌جو',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0B2C4A]">سیاست حریم خصوصی</h1>
      <p className="text-sm text-gray-600">آخرین به‌روزرسانی: شهریور ۱۴۰۵</p>
      <section className="space-y-3 text-sm leading-7 text-gray-800">
        <p>
          بیوتی‌جو («ما») متعهد به حفاظت از داده‌های شخصی کاربران است. این صفحه توضیح می‌دهد
          چه داده‌هایی جمع‌آوری می‌شود، چرا، و چگونه استفاده می‌شود.
        </p>
        <h2 className="text-lg font-semibold">۱. داده‌های جمع‌آوری‌شده</h2>
        <ul className="list-disc pr-5 space-y-1">
          <li>شماره موبایل برای ورود و احراز هویت (OTP)</li>
          <li>نام نمایشی و اطلاعات پروفایل که خودتان وارد می‌کنید</li>
          <li>اطلاعات رزرو، پرداخت و سوابق مرتبط با خدمات</li>
          <li>لاگ‌های فنی ضروری برای امنیت و عملکرد سرویس</li>
        </ul>
        <h2 className="text-lg font-semibold">۲. هدف استفاده</h2>
        <p>ارائه رزرو آنلاین، پشتیبانی، امنیت حساب، و بهبود تجربه کاربری. فروش داده به اشخاص ثالث انجام نمی‌شود.</p>
        <h2 className="text-lg font-semibold">۳. کوکی و ردیابی</h2>
        <p>
          برای ورود امن ممکن است کوکی‌های ضروری (مثل نشست) استفاده شود. جزئیات در{' '}
          <Link href="/cookies" className="text-[#2D6CDF] underline">سیاست کوکی</Link> آمده است.
        </p>
        <h2 className="text-lg font-semibold">۴. حقوق شما</h2>
        <p>می‌توانید درخواست اصلاح یا حذف داده‌های حساب را از طریق پشتیبانی مطرح کنید.</p>
        <h2 className="text-lg font-semibold">۵. تماس</h2>
        <p>برای سوالات حریم خصوصی با پشتیبانی بیوتی‌جو از داخل پنل یا ایمیل پشتیبانی تماس بگیرید.</p>
      </section>
      <Link href="/" className="text-sm text-[#2D6CDF] underline">بازگشت به صفحه اصلی</Link>
    </div>
  );
}
