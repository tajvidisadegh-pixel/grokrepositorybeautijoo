export default function Loading() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center" dir="rtl">
      <div
        className="size-10 animate-spin rounded-full border-[3px] border-coral/30 border-t-coral"
        aria-hidden
      />
      <p className="text-base font-medium text-navy">در حال آماده‌سازی صفحه…</p>
      <p className="max-w-xs text-sm leading-6 text-gray">
        اگر چند ثانیه طول کشید، اتصال اینترنت را چک کنید یا صفحه را تازه کنید.
      </p>
    </div>
  );
}
