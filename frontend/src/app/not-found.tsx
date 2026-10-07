import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="mb-2 text-sm font-medium text-coral">خطای ۴۰۴</p>
      <h1 className="mb-3 text-3xl font-bold text-gray-dark sm:text-4xl">صفحه پیدا نشد</h1>
      <p className="mb-8 max-w-md text-sm text-gray sm:text-base">
        آدرس واردشده وجود ندارد یا جابه‌جا شده است. می‌توانید به صفحه اصلی برگردید یا زیباگر مورد نظرتان را جستجو کنید.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-coral px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
        >
          بازگشت به صفحه اصلی
        </Link>
        <Link
          href="/search"
          className="rounded-xl border border-border bg-white px-6 py-2.5 text-sm font-medium text-gray-dark transition-colors hover:bg-gray-light"
        >
          جستجوی زیباگر
        </Link>
      </div>
    </div>
  );
}
