import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'چرا بیوتی‌جو؟', description: 'اعتماد، لغو شفاف، پشتیبانی' };

const items = [
  { t: 'لغو شفاف', d: 'تا چند ساعت قبل از نوبت می‌توانید رایگان لغو کنید.' },
  { t: 'زیباگر بررسی‌شده', d: 'پروفایل‌های منتشرشده بررسی می‌شوند؛ نشان احراز هویت برای موارد تأییدشده است.' },
  { t: 'پشتیبانی واقعی', d: 'دکمه کمک در مسیر رزرو؛ ایمیل و ساعات پاسخ‌گویی مشخص است.' },
  { t: 'قیمت بدون غافلگیری', d: 'مبلغ نهایی را قبل از پرداخت می‌بینید.' },
];

export default function WhyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-12" dir="rtl">
      <h1 className="text-3xl font-bold text-blue">چرا بیوتی‌جو؟</h1>
      <ul className="space-y-4">{items.map((it) => (
        <li key={it.t} className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">{it.t}</h2>
          <p className="mt-2 text-sm text-gray leading-7">{it.d}</p>
        </li>
      ))}</ul>
      <div className="flex flex-wrap gap-3">
        <Link href="/search" className="inline-flex h-11 items-center rounded-2xl bg-coral px-5 text-sm font-medium text-white">شروع جستجو</Link>
        <Link href="/refund" className="inline-flex h-11 items-center rounded-2xl border border-border px-5 text-sm">قوانین لغو</Link>
      </div>
    </main>
  );
}
