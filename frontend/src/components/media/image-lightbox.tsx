'use client';

import { useCallback, useEffect } from 'react';

export type LightboxItem = {
  id: string;
  url: string;
  mimeType?: string;
  caption?: string;
};

function isVideo(mime?: string) {
  return (mime || '').startsWith('video/');
}

type Props = {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
};

/** Full-screen media lightbox — centered on mobile & desktop */
export function ImageLightbox({ items, index, onClose, onIndexChange }: Props) {
  const n = items.length;
  const current = n > 0 ? items[((index % n) + n) % n] : null;

  const go = useCallback(
    (delta: number) => {
      if (n <= 1) return;
      onIndexChange(((index + delta) % n + n) % n);
    },
    [index, n, onIndexChange],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(-1);
      if (e.key === 'ArrowLeft') go(1);
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="بزرگ‌نمایی تصویر"
      onClick={onClose}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex shrink-0 items-center justify-between px-3 py-2 text-white sm:px-4 sm:py-3">
        <span className="text-sm opacity-80" dir="ltr">
          {index + 1} / {n}
        </span>
        <button
          type="button"
          className="rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          بستن
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-12"
        onClick={(e) => e.stopPropagation()}
      >
        {n > 1 && (
          <>
            <button
              type="button"
              aria-label="قبلی"
              className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 px-2.5 py-2 text-lg text-white hover:bg-white/30 sm:right-2 sm:px-3"
              onClick={() => go(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="بعدی"
              className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 px-2.5 py-2 text-lg text-white hover:bg-white/30 sm:left-2 sm:px-3"
              onClick={() => go(1)}
            >
              ›
            </button>
          </>
        )}

        <div className="flex h-full w-full max-w-[100vw] items-center justify-center">
          {isVideo(current.mimeType) ? (
            <video
              key={current.id}
              src={current.url}
              className="max-h-[min(80vh,100%)] max-w-[min(100%,100vw-1rem)] rounded-lg object-contain"
              controls
              playsInline
              autoPlay
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={current.id}
              src={current.url}
              alt={current.caption || ''}
              className="max-h-[min(80vh,100%)] max-w-[min(100%,100vw-1rem)] rounded-lg object-contain"
            />
          )}
        </div>
      </div>

      {current.caption && (
        <p className="shrink-0 px-4 pb-4 text-center text-sm text-white/90 sm:pb-6">
          {current.caption}
        </p>
      )}
    </div>
  );
}
