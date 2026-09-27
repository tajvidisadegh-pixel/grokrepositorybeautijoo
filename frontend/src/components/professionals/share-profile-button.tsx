'use client';

import { useState } from 'react';

type Props = {
  slug: string;
  name: string;
  className?: string;
};

/** Share public pro profile — Web Share API or copy link (issue #38 / #40). */
export function ShareProfileButton({ slug, name, className = '' }: Props) {
  const [msg, setMsg] = useState<string | null>(null);

  async function share() {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/professionals/${slug}`
        : `/professionals/${slug}`;
    const title = `${name} — زیباگر در بیوتی‌جو`;
    const text = `پروفایل ${name} را در بیوتی‌جو ببینید`;

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text, url });
        setMsg('اشتراک‌گذاری شد');
        return;
      }
    } catch {
      /* user cancelled or failed — fall through to copy */
    }

    try {
      await navigator.clipboard.writeText(url);
      setMsg('لینک کپی شد');
    } catch {
      setMsg('کپی لینک ممکن نشد');
    }
    window.setTimeout(() => setMsg(null), 2500);
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={share}
        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-gray-light"
      >
        <span aria-hidden>↗</span>
        اشتراک‌گذاری
      </button>
      {msg && <p className="mt-1 text-xs text-emerald-700">{msg}</p>}
    </div>
  );
}
