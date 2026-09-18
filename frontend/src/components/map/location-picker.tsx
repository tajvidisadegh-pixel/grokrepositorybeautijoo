'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons in bundlers
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const TEHRAN: [number, number] = [35.6892, 51.389];

type Props = {
  latitude: number | null;
  longitude: number | null;
  onPick: (lat: number, lng: number) => void;
  height?: number;
  readOnly?: boolean;
};

export default function LocationPicker({
  latitude,
  longitude,
  onPick,
  height = 220,
  readOnly = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] =
      latitude != null && longitude != null ? [latitude, longitude] : TEHRAN;

    const map = L.map(containerRef.current, {
      center,
      zoom: latitude != null ? 15 : 11,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    if (latitude != null && longitude != null) {
      markerRef.current = L.marker([latitude, longitude]).addTo(map);
    }

    if (!readOnly) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }
        onPick(Number(lat.toFixed(7)), Number(lng.toFixed(7)));
      });
    }

    mapRef.current = map;

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (latitude == null || longitude == null) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }
    const pos: [number, number] = [latitude, longitude];
    if (markerRef.current) {
      markerRef.current.setLatLng(pos);
    } else {
      markerRef.current = L.marker(pos).addTo(map);
    }
    map.setView(pos, Math.max(map.getZoom(), 14));
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      className="z-0 w-full overflow-hidden rounded-xl border border-border"
      style={{ height }}
    />
  );
}
