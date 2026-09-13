# Liara: «ناسازگاری موقت دیتابیس» (Prisma P2022)

## Symptom

On production (Liara), actions such as:

- Opening **ادامه تکمیل پروفایل** (`/zibagar/profile/complete`)
- Loading `/api/v1/professionals/me` or public professional by slug
- Media upload / selected categories

show:

> ناسازگاری موقت دیتابیس. لطفاً چند لحظه دیگر تلاش کنید.

## Known case (2026-09-13)

```
Prisma P2022 missing column model=Professional column=working_hours.created_at
The column `working_hours.created_at` does not exist in the current database.
```

**Fix shipped in repo:**

- `backend/prisma/sql/ensure-runtime.sql` adds `working_hours.created_at` / `updated_at`
- Migration `20260913100000_working_hours_timestamps`

**Operator:** Redeploy **Backend** on Liara so boot scripts run.

## Cause

Backend maps this to **Prisma `P2022`**: the running Prisma Client expects a **column** that is **missing** in the PostgreSQL database (schema drift).

This is **not** caused by frontend color/logo commits.

## Fix (required on Liara)

The backend Docker image heals schema on boot:

1. `backend/prisma/sql/ensure-runtime.sql`
2. `prisma db push`
3. `prisma migrate deploy`

See `backend/scripts/prisma-migrate-deploy.cjs` and `backend/Dockerfile` `CMD`.

### Operator steps

1. **Redeploy the Backend service** on Liara with the **latest backend code** from `main`.
2. Watch deploy logs for:
   - `[prisma-migrate] ensure-runtime.sql OK`
   - `[prisma-migrate] db push OK`
   - `[prisma-migrate] boot alignment finished`
3. Confirm API health: `GET /api/v1/health`
4. Retry professional profile complete / public profile.

### Verify from logs

```text
Prisma P2022 missing column model=... column=...
```

## Related files

- `backend/prisma/sql/ensure-runtime.sql`
- `backend/prisma/migrations/20260913100000_working_hours_timestamps/`
- `backend/scripts/prisma-migrate-deploy.cjs`
- `backend/Dockerfile`
- `backend/src/common/filters/http-exception.filter.ts`
