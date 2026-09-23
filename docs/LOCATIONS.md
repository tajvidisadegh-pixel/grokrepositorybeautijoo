# Locations (issue #21)

## Model

- Each **Professional** has **exactly one** location (`professional_locations.professional_id` is unique).
- `locations.precision`: `exact` | `approximate` (default `approximate`).

## Privacy

- **exact**: address + coordinates may appear on public profile/map.
- **approximate**: public API strips `latitude`/`longitude` and shows city/area only (`محدوده …`).

## APIs

- `POST/PATCH /professionals/me/locations` — upsert the single location (create replaces existing).
- Public catalog/detail uses `sanitizePublicLocations`.

## Panel

- `/zibagar/locations` — single «مکان کار» form with precision toggle.
