'use client';

import { useMemo, useState } from 'react';
import { ImageLightbox } from '@/components/media/image-lightbox';

type Media = {
  id: string;
  publicUrl?: string | null;
  url?: string | null;
  mimeType?: string | null;
  title?: string | null;
};

function isVideo(mime?: string | null) {
  return (mime || '').startsWith('video/');
}

export function SalonMediaGallery({ media }: { media: Media[] }) {
  const items = useMemo(
    () =>
      (media || [])
        .map((m) => ({
          id: m.id,
          url: (m.publicUrl || m.url || '').trim(),
          mimeType: m.mimeType || undefined,
          caption: m.title || undefined,
        }))
        .filter((m) => m.url),
    [media],
  );

  const [index, setIndex] = useState<number | null>(null);

  if (!items.length) return null;

  return (
    <section className="rounded-3xl border border-border/90 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-foreground">عکس‌های محل</h2>
      <p className="text-xs text-gray">نمونه کارها · پس از تأیید زیباگر</p>
      <p className="mt-1 text-xs text-gray">برای بزرگ‌نمایی روی عکس بزنید</p>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {items.map((m, i) => (
          <button
            key={m.id}
            type="button"
            className="h-36 w-52 shrink-0 overflow-hidden rounded-2xl border border-border bg-gray-light"
            onClick={() => setIndex(i)}
          >
            {isVideo(m.mimeType) ? (
              <video src={m.url} className="h-full w-full object-cover" muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt={m.caption || 'محل'} className="h-full w-full object-cover" />
            )}
          </button>
        ))}
      </div>
      {index != null && (
        <ImageLightbox
          items={items}
          index={index}
          onClose={() => setIndex(null)}
          onIndexChange={setIndex}
        />
      )}
    </section>
  );
}
