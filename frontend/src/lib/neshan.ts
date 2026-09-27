/**
 * Neshan (نشان) map helpers — Iranian maps for accurate local routing (issue #33).
 * Uses public neshan.org deep-links (no API key required for navigation).
 * Optional NEXT_PUBLIC_NESHAN_API_KEY enables static map images from Neshan API.
 */

export function neshanMapUrl(lat: number, lng: number, zoom = 15): string {
  return `https://neshan.org/maps/@${lat},${lng},${zoom}z`;
}

/** Car directions to destination (origin = user current location in Neshan app/web). */
export function neshanDirectionsUrl(lat: number, lng: number): string {
  return `https://neshan.org/maps/routing/car/destination/${lat},${lng}`;
}

/** Static map image when API key is present; otherwise null. */
export function neshanStaticMapUrl(
  lat: number,
  lng: number,
  opts?: { width?: number; height?: number; zoom?: number },
): string | null {
  const key =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_NESHAN_API_KEY || '').trim()
      : '';
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
