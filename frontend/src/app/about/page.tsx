import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, siteName } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'درباره ما',
  description: `آشنایی با ${siteName()} — پلتفرم رزرو آنلاین خدمات زیبایی.`,
  path: '/about',
});

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0B2C4A]">درباره {siteName()}</h1>
      <p className="text-sm text-gray-600">پلتفرم رزرو آنلاین خدمات زیبایی</p>

      <section className="space-y-3 text-sm leading-7 text-gray-800">
        <p>
          <strong className="text-[#0B2C4A]">{siteName()}</strong> (بیوتی‌جو) یک پلتفرم
          واسط است که مشتریان را به زیباگران حرفه‌ای وصل می‌کند: جستجو، مشاهده پروفایل و
          نمونه‌کار، رزرو نوبت، پرداخت و پیگیری از یکجا.
        </p>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">چه می‌کنیم؟</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>معرفی زیباگران با پروفایل، خدمات، قیمت و ساعات کاری شفاف</li>
          <li>رزرو آنلاین و یادآوری نوبت</li>
          <li>امکان ثبت نظر پس از اتمام خدمت</li>
          <li>پنل جدا برای مشتری و زیباگر</li>
        </ul>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">چه نمی‌کنیم؟</h2>
        <p>
          خودِ خدمت زیبایی توسط زیباگر در محل فعالیت او انجام می‌شود. بیوتی‌جو
          ارائه‌دهنده مستقیم خدمات زیبایی نیست؛ نقش ما اتصال، رزرو و تسهیل ارتباط است.
        </p>

        
        <h2 className="text-lg font-semibold text-[#0B2C4A]">مدل درآمد و مسئولیت</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>بیوتی‌جو واسط رزرو است؛ خدمت را زیباگر ارائه می‌دهد.</li>
          <li>کارمزد پلتفرم از مبلغ رزرو طبق تنظیمات مالی کسر می‌شود و در پنل زیباگر قابل مشاهده است.</li>
          <li>پرداخت آنلاین از درگاه معتبر انجام می‌شود؛ نتیجه در صفحه تأیید رزرو نمایش داده می‌شود.</li>
          <li>برای شکایت یا پیگیری به صفحه «ثبت شکایت» مراجعه کنید.</li>
        </ul>

        <h2 className="text-lg font-semibold text-[#0B2C4A]">ارتباط با ما</h2>
        <p>
          برای پشتیبانی یا پیشنهادها به صفحه{' '}
          <Link href="/contact" className="text-[#2D6CDF] underline">
            تماس با ما
          </Link>{' '}
          سر بزنید. سوالات پرتکرار در{' '}
          <Link href="/faq" className="text-[#2D6CDF] underline">
            سوالات متداول
          </Link>{' '}
          آمده است.
        </p>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-border pt-4 text-sm">
        <Link href="/terms" className="text-[#2D6CDF] underline">
          شرایط استفاده
        </Link>
        <Link href="/privacy" className="text-[#2D6CDF] underline">
          حریم خصوصی
        </Link>
        <Link href="/refund" className="text-[#2D6CDF] underline">
          کنسلی و بازپرداخت
        </Link>
              <Link href="/complaint" className="text-[#2D6CDF] underline">
          ثبت شکایت
        </Link>
      </div>
    </div>
  );
}

