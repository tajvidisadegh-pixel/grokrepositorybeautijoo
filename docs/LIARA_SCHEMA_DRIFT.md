# Liara: «ناسازگاری موقت دیتابیس» (Prisma P2022)

## Symptom

On production (Liara), actions such as:

- Opening **ادامه تکمیل پروفایل** (`/zibagar/profile/complete`)
- Loading `/api/v1/professionals/me`
- Media upload / selected categories

show:

> ناسازگاری موقت دیتابیس. لطفاً چند لحظه دیگر تلاش کنید.

## Cause

Backend maps this to **Prisma `P2022`**: the running Prisma Client expects a **column** that is **missing** in the PostgreSQL database (schema drift).

This is **not** caused by frontend color/logo commits. Those only touch `frontend/`.

Typical missing columns on older Liara DBs:

- `professionals.selected_category_ids`, `logo_url`, `cover_image_url`, `published_at`
- `media_assets.url`
- `users.account_type`
- `professional_locations.id`
- `working_hours.is_active` / `is_closed`

## Fix (required on Liara)

The backend Docker image **already** heals schema on boot:

1. `backend/prisma/sql/ensure-runtime.sql` (idempotent `ADD COLUMN IF NOT EXISTS`)
2. `prisma db push`
3. `prisma migrate deploy`

See `backend/scripts/prisma-migrate-deploy.cjs` and `backend/Dockerfile` `CMD`.

### Operator steps

1. **Redeploy the Backend service** on Liara with the **latest backend code** (same release as `main` / tagged export).
2. Watch deploy logs for:
   - `[prisma-migrate] ensure-runtime.sql OK`
   - `[prisma-migrate] db push OK`
   - `[prisma-migrate] boot alignment finished`
3. Confirm API health: `GET /api/v1/health`
4. Retry professional profile complete.

If Auto Deploy is bound to an old export branch (`beautijoo-backend-export`), update that branch from a current tag / `main` backend subtree, then redeploy.

### Verify missing column from logs

Search backend logs for:

```text
Prisma P2022 missing column model=... column=...
```

That names the exact table/column still missing after a failed heal.

## What not to do

- Do not “fix” this by changing frontend colors.
- Do not drop production data unless you intentionally reset the DB.
- Code rollback does **not** roll back already-applied migrations.

## Related files

- `backend/prisma/sql/ensure-runtime.sql`
- `backend/scripts/prisma-migrate-deploy.cjs`
- `backend/Dockerfile`
- `backend/src/common/filters/http-exception.filter.ts` (user-facing message)
