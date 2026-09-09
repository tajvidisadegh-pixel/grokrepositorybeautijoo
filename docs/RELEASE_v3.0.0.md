# Beautijoo v3.0.0 — Stable Release

**Tag:** `v3.0.0`  
**Date:** 2026-09-09

## Summary

Stable production release after full resolution of Code Review [issue #37](https://github.com/tajvidimaryam7899-del/grokrepositorybeautijoo/issues/37) (items 1–10).

## Included fixes

| # | Area | Change |
|---|------|--------|
| 1 | Timezone | IANA `Asia/Tehran` helpers (no fixed offset) |
| 2 | Bookings | `$transaction` + `SELECT FOR UPDATE` + GiST exclude |
| 3 | Revenue | `REVENUE_DATA_RELIABLE = true` |
| 4 | Refund | Provider refund + admin API + `refundImplemented` |
| 5 | Payments | Zarinpal v4 + `PAYMENT_PROVIDER` factory |
| 6 | JWT | Ban weak secrets; prod requires strong distinct secrets |
| 7 | CORS | Prod requires explicit non-localhost `CORS_ORIGINS` |
| 8 | Swagger | UI only when `NODE_ENV !== production` |
| 9 | OTP | Cooldown 60s, 3/hour, 8/day, max 3 verify attempts |
| 10 | ESLint | Enforced in frontend CI and `next build` |

## Deploy (Liara backend)

- Branch: **`beautijoo-backend-export`** (subtree of `backend/` from this tag)
- Platform: Docker (`backend/Dockerfile`, port 3000)
- On start: `prisma migrate deploy` → seed roles → `node dist/main.js`

### Required production environment variables

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` (set in Dockerfile) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ≥ 32 chars, strong |
| `JWT_REFRESH_SECRET` | ≥ 32 chars, **different** from access |
| `CORS_ORIGINS` | e.g. `https://beautijoo.ir,https://www.beautijoo.ir` |

Generate secrets:

```bash
openssl rand -hex 32
```

### Optional

- `PAYMENT_PROVIDER=zarinpal` + `ZARINPAL_MERCHANT_ID` / sandbox / access token
- `STORAGE_PROVIDER=s3` + `S3_*` for object storage

## CI status

Backend and frontend builds green on the release commit.

## Upgrade notes

- Existing JWT tokens remain valid only if secrets are unchanged.
- OTP clients must respect cooldown / rate-limit error messages.
- Production misconfiguration (missing JWT/CORS) fails fast at boot by design.
