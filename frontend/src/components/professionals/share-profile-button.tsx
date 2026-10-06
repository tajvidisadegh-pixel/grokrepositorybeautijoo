'use client';

import { useState } from 'react';

type Props = {
  slug: string;
  name: string;
  className?: string;
};

/** Share public pro profile — Web Share / WhatsApp / Telegram / copy (issue #40 item 23). */
export function ShareProfileButton({ slug, name, className = '' }: Props) {
  const [msg, setMsg] = useState<string | null>(null);

  function profileUrl() {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/professionals/${slug}`;
    }
    return `/professionals/${slug}`;
  }

  async function shareNative() {
    const url = profileUrl();
    const title = `${name} — زیباگر در بیوتی‌جو`;
    const text = `پروفایل ${name} را در بیوتی‌جو ببینید`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text, url });
        setMsg('اشتراک‌گذاری شد');
        window.setTimeout(() => setMsg(null), 2500);
        return;
      }
    } catch {
      /* cancelled */
    }
    await copyLink();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(profileUrl());
      setMsg('لینک کپی شد');
    } catch {
      setMsg('کپی لینک ممکن نشد');
    }
    window.setTimeout(() => setMsg(null), 2500);
  }

  const url = typeof window !== 'undefined' ? profileUrl() : `/professionals/${slug}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`پروفایل ${name} در بیوتی‌جو:\n${url}`)}`;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`پروفایل ${name} در بیوتی‌جو`)}`;

  const btn =
    'inline-flex h-9 items-center justify-center rounded-xl border border-border bg-white px-3 text-xs font-medium transition-colors hover:border-coral hover:text-coral';

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void shareNative()} className={btn}>
          ↗ اشتراک
        </button>
        <a href={wa} target="_blank" rel="noopener noreferrer" className={btn}>
          واتساپ
        </a>
        <a href={tg} target="_blank" rel="noopener noreferrer" className={btn}>
          تلگرام
        </a>
        <button type="button" onClick={() => void copyLink()} className={btn}>
          کپی لینک
        </button>
      </div>
      {msg && <p className="mt-1 text-xs text-emerald-700">{msg}</p>}
    </div>
  );
}
