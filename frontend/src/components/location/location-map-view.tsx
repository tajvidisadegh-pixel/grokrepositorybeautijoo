'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  neshanDirectionsUrl,
  neshanMapUrl,
  neshanStaticMapUrl,
  neshanTileUrlTemplate,
} from '@/lib/neshan';

type Position = { lat: number; lng: number };

type Props = {
  position: Position;
  height?: string;
  zoom?: number;
  className?: string;
  /** exact = show pin; approximate = no public pin (issue #33 privacy) */
  precision?: 'exact' | 'approximate' | string | null;
};

type LeafletMods = {
  MapContainer: typeof import('react-leaflet').MapContainer;
  TileLayer: typeof import('react-leaflet').TileLayer;
  Marker: typeof import('react-leaflet').Marker;
};

function LocationMapViewInner({
  position,
  height = '220px',
  zoom = 14,
  className,
  precision,
}: Props) {
  const [mods, setMods] = useState<LeafletMods | null>(null);
  const isExact = precision !== 'approximate';
  const staticUrl = isExact
    ? neshanStaticMapUrl(position.lat, position.lng, {
        width: 640,
        height: 360,
        zoom,
      })
    : null;
  const tileUrl = neshanTileUrlTemplate();

  useEffect(() => {
    if (!isExact || staticUrl) return; // static image path — no Leaflet needed
    let cancelled = false;
    (async () => {
      await import('leaflet/dist/leaflet.css');
      const L = await import('leaflet');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });
      const rl = await import('react-leaflet');
      if (!cancelled) {
        setMods({
          MapContainer: rl.MapContainer,
          TileLayer: rl.TileLayer,
          Marker: rl.Marker,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isExact, staticUrl]);

  const actions = (
    <div className="mt-2 flex flex-wrap gap-2">
      {isExact && (
        <a
          href={neshanDirectionsUrl(position.lat, position.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full bg-coral px-3 py-1.5 text-xs font-medium text-white hover:bg-coral-dark"
        >
          مسیریابی با نشان
        </a>
      )}
      {isExact && (
        <a
          href={neshanMapUrl(position.lat, position.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-full border border-border bg-white px-3 py-1.5 text-xs text-foreground"
        >
          مشاهده در نقشه نشان
        </a>
      )}
    </div>
  );

  if (!isExact) {
    return (
      <div className={className}>
        <div
          className="flex items-center justify-center rounded-xl border border-border bg-gray-light/40 px-4 text-center text-sm text-gray"
          style={{ height }}
        >
          موقعیت به‌صورت تقریبی ثبت شده؛ پین دقیق روی نقشه نمایش داده نمی‌شود.
        </div>
      </div>
    );
  }

  if (staticUrl) {
    return (
      <div className={className}>
        <a href={neshanMapUrl(position.lat, position.lng)} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={staticUrl}
            alt="نقشه نشان"
            className="w-full rounded-xl border border-border object-cover"
            style={{ height }}
          />
        </a>
        {actions}
      </div>
    );
  }

  if (!mods) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-border bg-gray-light/40 text-sm text-gray ${className || ''}`}
        style={{ height }}
      >
        در حال بارگذاری نقشه…
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker } = mods;
  const center: [number, number] = [position.lat, position.lng];
  const url =
    tileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution = tileUrl
    ? '&copy; <a href="https://neshan.org" target="_blank" rel="noopener">نشان</a>'
    : '&copy; <a href="https://neshan.org" target="_blank" rel="noopener">نشان</a> · OSM';

  return (
    <div className={className}>
      <div className="relative z-0 overflow-hidden rounded-xl border border-border" style={{ height }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer attribution={attribution} url={url} />
          <Marker position={center} />
        </MapContainer>
      </div>
      {actions}
    </div>
  );
}

const LocationMapView = dynamic(() => Promise.resolve(LocationMapViewInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-[220px] items-center justify-center rounded-xl border border-border bg-gray-light/40 text-sm text-gray">
      در حال بارگذاری نقشه…
    </div>
  ),
});

export default LocationMapView;
