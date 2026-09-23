# Near Me (issue #24)

## Flow

1. Customer taps **نزدیک من** on `/search`.
2. Browser Geolocation permission (Persian prompts).
3. `lat` / `lng` / `radiusKm` sent as query params (not stored on user).
4. Backend: bounding-box prefilter → Haversine → exclude missing coords → sort by distance → paginate.
5. Cards show distance (`formatDistanceFromYou`); approximate locations use coarser wording.
6. Public API still sanitizes exact lat/lng when `precision=approximate`.

## No PostGIS

Uses existing `geo.ts` Haversine + bbox (no migration).
