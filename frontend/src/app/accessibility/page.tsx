import type { Metadata } from 'next';
import { pageMetadata, siteName } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'دسترس‌پذیری',
  description: `تعهد دسترس‌پذیری ${siteName()}`,
  path: '/accessibility',
});

export default function AccessibilityPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold">دسترس‌پذیری</h1>
      <p className="text-sm leading-7 text-gray-800">
        تلاش می‌کنیم رزرو و پنل با صفحه‌کلید قابل استفاده باشد: لینک «رد شدن به محتوا»،
        برچسب دکمه‌ها، و کنتراست مناسب در تم روشن/تاریک. اگر مانعی دیدید از صفحه شکایت یا تماس اطلاع دهید.
      </p>
      <ul className="list-disc space-y-1 pr-5 text-sm text-gray-800">
        <li>ناوبری با Tab در فرم‌های ورود و رزرو</li>
        <li>پیام خطا به‌صورت متنی (نه فقط رنگ)</li>
        <li>پشتیبانی از prefers-color-scheme و دکمه تم</li>
      </ul>
    </div>
  );
}
