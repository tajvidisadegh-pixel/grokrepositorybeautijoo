/**
 * Neshan (نشان) map helpers — Iranian maps for accurate local routing (issue #33).
 */

export function getNeshanApiKey(): string {
  if (typeof process === 'undefined') return '';
  return (process.env.NEXT_PUBLIC_NESHAN_API_KEY || '').trim();
}

/** Leaflet-compatible Neshan raster tiles when API key is set. */
export function neshanTileUrlTemplate(): string | null {
  const key = getNeshanApiKey();
  if (!key) return null;
  // Official raster tiles — see https://platform.neshan.org
  return `https://api.neshan.org/tile/{z}/{x}/{y}?key=${encodeURIComponent(key)}`;
}

export function neshanMapUrl(lat: number, lng: number, zoom = 15): string {
  return `https://neshan.org/maps/@${lat},${lng},${zoom}z`;
}

export function neshanDirectionsUrl(lat: number, lng: number): string {
  return `https://neshan.org/maps/routing/car/destination/${lat},${lng}`;
}

export function neshanStaticMapUrl(
  lat: number,
  lng: number,
  opts?: { width?: number; height?: number; zoom?: number },
): string | null {
  const key = getNeshanApiKey();
  if (!key) return null;
  const w = opts?.width ?? 640;
  const h = opts?.height ?? 360;
  const z = opts?.zoom ?? 15;
  const params = new URLSearchParams({
    key,
    type: 'neshan',
    width: String(w),
    height: String(h),
    zoom: String(z),
    center: `${lat},${lng}`,
    marker: 'redcolor',
  });
  return `https://api.neshan.org/v4/static?${params.toString()}`;
}
