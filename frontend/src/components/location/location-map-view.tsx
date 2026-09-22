'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

export type MapPosition = { lat: number; lng: number };

type Props = {
  position: MapPosition;
  height?: string;
  zoom?: number;
  className?: string;
};

type LeafletMods = {
  MapContainer: typeof import('react-leaflet').MapContainer;
  TileLayer: typeof import('react-leaflet').TileLayer;
  Marker: typeof import('react-leaflet').Marker;
};

function LocationMapViewInner({ position, height = '220px', zoom = 14, className }: Props) {
  const [mods, setMods] = useState<LeafletMods | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await import('leaflet/dist/leaflet.css');
      const L = await import('leaflet');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
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
  }, []);

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

  return (
    <div
      className={`relative z-0 overflow-hidden rounded-xl border border-border ${className || ''}`}
      style={{ height }}
    >
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={center} />
      </MapContainer>
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
