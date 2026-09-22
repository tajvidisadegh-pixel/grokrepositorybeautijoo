# API versioning — Beautijoo

## Current surface

| Item | Value |
|------|--------|
| Path prefix | `/api/v1` |
| Response header | `X-API-Version: v1` |
| App release header | `X-App-Version: 3.0.0` (override with `APP_VERSION`) |
| OpenAPI JSON | `GET /api/v1/openapi.json` (all environments) |
| Swagger UI | `/api/docs` (non-production only) |
| Health | `GET /api/v1/health` includes `apiVersion` + `appVersion` |

## Strategy

1. **v1 is stable.** Additive, non-breaking changes (new optional fields, new endpoints) stay on `/api/v1`.
2. **Breaking changes** (renamed/removed fields, changed auth semantics, incompatible status codes) require a new major path: `/api/v2`, with a documented migration window.
3. **Deprecation.** When a v1 field or route is superseded, prefer:
   - keep it working for at least one minor release cycle;
   - document in OpenAPI `deprecated: true` and in release notes;
   - optional response header `Deprecation: true` / `Sunset: <date>` on that route (future).
4. **Clients** should read `X-API-Version` and treat unknown major versions as unsupported.

## OpenAPI

- Machine-readable contract: `/api/v1/openapi.json`
- Human UI (dev/staging): `/api/docs`
- Generate clients with any OpenAPI 3 tool against the JSON export.

## Changelog

Release-level notes live in `docs/RELEASE_v3.0.0.md` and GitHub Releases. Endpoint-level changes should be reflected in OpenAPI descriptions when they ship.
