'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ProfessionalServiceItem } from '@/types/public';
import { formatPrice } from '@/lib/utils';

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
  const [active, setActive] = useState<MediaItem | null>(null);

  const visible = filter === 'همه' ? items : items.filter((i) => i.serviceName === filter);

  if (!items.length) return null;

  return (
    <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold">نمونه‌کار خدمات</h2>
      <p className="mt-1 text-xs text-gray">جدا از عکس‌های محل — به‌صورت افقی مرور کنید</p>
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
      {/* Horizontal gallery (issue #33 / #38) */}
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {visible.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActive(m)}
            className="w-40 shrink-0 overflow-hidden rounded-2xl border border-border text-right sm:w-52"
          >
            {isVideo(m.mimeType) ? (
              <video src={m.publicUrl} className="h-36 w-full object-cover" muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.publicUrl} alt="" className="h-36 w-full object-cover" />
            )}
            <div className="p-2">
              <p className="truncate text-xs font-medium">{m.serviceName}</p>
              <p className="text-xs text-coral">{formatPrice(m.price)}</p>
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setActive(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {isVideo(active.mimeType) ? (
              <video src={active.publicUrl} className="w-full rounded-2xl" controls playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.publicUrl} alt="" className="w-full rounded-2xl object-cover" />
            )}
            <h3 className="mt-3 text-lg font-bold">{active.serviceName}</h3>
            <p className="mt-1 text-sm text-gray">
              {formatPrice(active.price)} · {active.durationMin} دقیقه
            </p>
            <Link
              href={`/booking/${slug}?serviceId=${encodeURIComponent(active.serviceId)}`}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-2xl bg-coral text-sm font-medium text-white"
            >
              رزرو همین مدل
            </Link>
            <button type="button" className="mt-2 w-full text-sm text-gray" onClick={() => setActive(null)}>
              بستن
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
