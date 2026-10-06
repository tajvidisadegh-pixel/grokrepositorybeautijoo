'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ProfessionalServiceItem } from '@/types/public';
import { formatPrice } from '@/lib/utils';
import { ImageLightbox } from '@/components/media/image-lightbox';

type MediaItem = {
  id: string;
  publicUrl: string;
  mimeType: string;
  title?: string | null;
  serviceName: string;
  serviceId: string;
  price: number;
  durationMin: number;
};

function isVideo(mime?: string) {
  return (mime || '').startsWith('video/');
}

export function ServicePortfolioGallery({
  slug,
  services,
}: {
  slug: string;
  services: ProfessionalServiceItem[];
}) {
  const items = useMemo(() => {
    const out: MediaItem[] = [];
    for (const ps of services || []) {
      for (const m of ps.mediaAssets || []) {
        out.push({
          id: m.id,
          publicUrl: m.publicUrl,
          mimeType: m.mimeType,
          title: m.title,
          serviceName: ps.service?.name || 'خدمت',
          serviceId: ps.service?.id || '',
          price: ps.price,
          durationMin: ps.durationMin,
        });
      }
    }
    return out;
  }, [services]);

  const filters = useMemo(() => {
    const names = Array.from(new Set(items.map((i) => i.serviceName)));
    return names;
  }, [items]);

  const [filter, setFilter] = useState<string>('همه');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visible = filter === 'همه' ? items : items.filter((i) => i.serviceName === filter);

  const lightboxItems = useMemo(
    () =>
      visible.map((m) => ({
        id: m.id,
        url: m.publicUrl,
        mimeType: m.mimeType,
        caption: `${m.serviceName} · ${formatPrice(m.price)} · ${m.durationMin} دقیقه`,
      })),
    [visible],
  );

  if (!items.length) return null;

  return (
    <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold">نمونه‌کار خدمات</h2>
      <p className="mt-1 text-xs text-gray">روی هر عکس بزنید تا بزرگ شود و ورق بزنید</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('همه')}
          className={`rounded-full border px-3 py-1 text-xs ${
            filter === 'همه' ? 'border-coral bg-coral text-white' : 'border-border'
          }`}
        >
          همه
        </button>
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === f ? 'border-coral bg-coral text-white' : 'border-border'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {visible.map((m, idx) => (
          <button
            key={m.id}
            type="button"
            className="w-40 shrink-0 text-right"
            onClick={() => setLightboxIndex(idx)}
          >
            <div className="h-36 overflow-hidden rounded-2xl border border-border bg-gray-light">
              {isVideo(m.mimeType) ? (
                <video src={m.publicUrl} className="h-full w-full object-cover" muted playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.publicUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="mt-1.5 px-0.5">
              <p className="truncate text-xs font-medium">{m.serviceName}</p>
              <p className="text-xs text-coral">{formatPrice(m.price)}</p>
            </div>
          </button>
        ))}
      </div>

      {lightboxIndex != null && (
        <ImageLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}

      {lightboxIndex != null && visible[lightboxIndex] && (
        <div className="fixed bottom-0 inset-x-0 z-[61] flex justify-center p-4 pointer-events-none">
          <Link
            href={`/booking/${slug}?serviceId=${encodeURIComponent(visible[lightboxIndex].serviceId)}`}
            className="pointer-events-auto inline-flex h-11 items-center rounded-2xl bg-coral px-5 text-sm font-medium text-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            رزرو همین مدل
          </Link>
        </div>
      )}
    </section>
  );
}
