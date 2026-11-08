# Security hygiene (#82.9 / #82.infra21)

## Done in code
- Image-only `/uploads` (no directory listing, path traversal blocked)
- OTP purpose whitelist + per-IP rate limit
- Auth throttles tightened
- `REVALIDATE_SECRET` must not be `NEXT_PUBLIC_*`
- Gitleaks workflow on push/PR (`.github/workflows/gitleaks.yml`)
- Seed catalog gated by `RUN_SEED_CATALOG_ON_BOOT`
- Impersonation start: `POST /admin/users/:id/impersonate` (SUPER_ADMIN only, audited)
- Template-literal syntax fix in booking cancelReason (build green path)

## Owner actions (required)
1. **Make the repository private** — GitHub → Settings → Danger Zone → Change visibility → Private.
2. Open **Actions → gitleaks**; if findings exist, **rotate** every exposed secret (JWT, DB, SMS, payment, S3, REVALIDATE_SECRET).
3. Prefer `STORAGE_PROVIDER=s3` in production multi-instance deploys.
4. When payment gateway is ready: set `BOOKING_PAYMENT_MODE` + `PAYMENT_PROVIDER` together and lock NOK callback auth.

## Env reference
See `backend/.env.example`.
