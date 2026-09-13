# Liara: «ناسازگاری موقت دیتابیس» (Prisma P2022) — Prevention

## Symptom

> ناسازگاری موقت دیتابیس. لطفاً چند لحظه دیگر تلاش کنید.

Maps to **Prisma `P2022`** (missing column).

## Root causes we hit

1. Production DB missing columns (e.g. `working_hours.created_at`)
2. Liara deploying from **`beautijoo-backend-export`** while fixes lived only on `main`

## Prevention (in repo now)

| Layer | What |
|-------|------|
| Auto-sync | GitHub Action syncs `beautijoo-backend-export` on every **push to `main` that touches `backend/**`** |
| Boot heal | `scripts/prisma-migrate-deploy.cjs`: ensure-runtime.sql → critical columns → `db push` → migrate |
| Runtime heal | `PrismaService.onModuleInit` re-applies critical `ADD COLUMN IF NOT EXISTS` |
| Migrations | Idempotent SQL under `prisma/migrations/` |

## Operator checklist

1. Keep Liara Backend bound to branch **`beautijoo-backend-export`** with Auto Deploy **on**.
2. After merging backend changes to `main`, wait for workflow **“Sync backend deployment branch”** to finish (or run it manually with `ref=main`).
3. Confirm Liara redeploy logs include `boot alignment finished` and `critical schema heal pass completed`.

## Manual emergency

```bash
# From backend root with production DATABASE_URL
npx prisma db execute --file prisma/sql/ensure-runtime.sql
npx prisma db push --accept-data-loss
```

Or Redeploy Backend on Liara (boot script runs automatically).

## Related

- `.github/workflows/sync-backend-deploy-branch.yml`
- `backend/scripts/prisma-migrate-deploy.cjs`
- `backend/prisma/sql/ensure-runtime.sql`
- `backend/src/prisma/prisma.service.ts`
