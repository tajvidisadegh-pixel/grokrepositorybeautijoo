/**
 * Pure geo helpers (Beautijoo 18.13).
 * Haversine distance + simple bounding box for radius filters.
 */

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Approx degree span for a radius (for coarse SQL bounding-box prefilter). */
export function boundingBox(
  lat: number,
  lng: number,
  radiusKm: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusKm / 111.32;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lngDelta = radiusKm / (111.32 * Math.max(0.2, Math.abs(cosLat)));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

export function parseGeoQuery(input: {
  lat?: string | number | null;
  lng?: string | number | null;
  radiusKm?: string | number | null;
}): { lat: number; lng: number; radiusKm: number } | null {
  const lat = input.lat != null && input.lat !== '' ? Number(input.lat) : NaN;
  const lng = input.lng != null && input.lng !== '' ? Number(input.lng) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  let radiusKm =
    input.radiusKm != null && input.radiusKm !== ''
      ? Number(input.radiusKm)
      : 15;
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) radiusKm = 15;
  radiusKm = Math.min(Math.max(radiusKm, 1), 200);
  return { lat, lng, radiusKm };
}
