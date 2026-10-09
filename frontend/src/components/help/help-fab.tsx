'use client';
import { useState } from 'react';
const EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@beautijoo.ir';
const HOURS = process.env.NEXT_PUBLIC_SUPPORT_HOURS || '۹ تا ۱۸ · شنبه تا چهارشنبه';
export function HelpFab() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-20 right-4 z-40 sm:bottom-8 sm:right-8">
      {open && (
        <div className="mb-2 w-64 rounded-2xl border border-border bg-white p-4 text-sm shadow-lg" dir="rtl">
          <p className="font-bold">نیاز به کمک دارید؟</p>
          <p className="mt-1 text-xs text-gray">ساعات پاسخ‌گویی: {HOURS}</p>
          <a className="mt-2 block text-coral underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>
          <a className="mt-1 block text-xs text-gray underline" href="/why">چرا بیوتی‌جو؟</a>
          <a className="mt-1 block text-xs text-gray underline" href="/refund">قوانین لغو</a>
        </div>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex h-12 items-center gap-2 rounded-full bg-blue px-4 text-sm font-medium text-white shadow-lg"
        aria-expanded={open}>کمک</button>
    </div>
  );
}
