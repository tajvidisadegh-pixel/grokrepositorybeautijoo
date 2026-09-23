'use client';

/** Short helper tip shown under each onboarding step (gap 18.16). */
export function OnboardingTip({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-blue/15 bg-blue/5 px-3 py-2.5 text-sm leading-6 text-gray">
      <span className="ml-1 font-medium text-blue">راهنما:</span> {children}
    </div>
  );
}

export const STEP_TIPS: Record<string, string> = {
  basic:
    'عنوان حرفه‌ای همان عبارتی است که مشتری در کارت شما می‌بیند (مثلاً «میکاپ آرتیست»). نام و نام‌خانوادگی برای اعتماد بیشتر است.',
  media:
    'عکس پروفایل واضح و کاور مرتبط، نرخ کلیک را بالا می‌برد. فرمت‌های JPEG/PNG/WebP پذیرفته می‌شود.',
  location:
    'محل اصلی فعالیت را مشخص کنید تا در جستجوی «نزدیک من» و فیلتر شهر دیده شوید. نقشه اختیاری است.',
  services:
    'حداقل یک تخصص انتخاب کنید. قیمت و مدت دقیق را بعداً در بخش «تخصص‌ها» تکمیل کنید.',
  hours:
    'روزها و بازه زمانی که معمولاً کار می‌کنید را بگذارید؛ مشتری فقط ساعت‌های آزاد واقعی را می‌بیند.',
  review:
    'پس از انتشار، پروفایل برای بررسی ارسال می‌شود. بعد از تأیید ادمین در سایت عمومی نمایش داده می‌شود.',
};

/** Short guide after first publish — how to get the first booking. */
export function FirstBookingGuide() {
  return (
    <div className="space-y-2 rounded-2xl border border-coral/20 bg-coral-soft/40 p-4 text-sm leading-6 text-gray">
      <p className="font-semibold text-coral">شروع سریع — اولین رزرو</p>
      <ol className="list-decimal space-y-1 pr-5">
        <li>در «تخصص‌ها» برای هر خدمت قیمت و مدت را کامل کنید.</li>
        <li>ساعات کاری را دقیق نگه دارید تا اسلات خالی نمایش داده شود.</li>
        <li>لینک پروفایل عمومی را در شبکه‌های اجتماعی به اشتراک بگذارید.</li>
        <li>رزروهای ورودی را از منوی «رزروها» تأیید یا مدیریت کنید.</li>
      </ol>
    </div>
  );
}
