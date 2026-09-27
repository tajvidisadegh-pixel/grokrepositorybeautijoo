'use client';

import Link from 'next/link';

/** Mobile sticky CTA — issue #38 item 3 (public pro UX). */
export function StickyBookBar({
  slug,
  label = 'رزرو نوبت',
}: {
  slug: string;
  label?: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-white/95 p-3 backdrop-blur md:hidden">
      <Link
        href={`/booking/${slug}`}
        className="flex h-12 w-full items-center justify-center rounded-2xl bg-coral text-sm font-bold text-white shadow-lg shadow-coral/25"
      >
        {label}
      </Link>
    </div>
  );
}
