# Liara Deploy — Beautijoo

> **مرجع فارسی و الزامی برنچ:** [`docs/BRANCH_AND_DEPLOY.md`](./docs/BRANCH_AND_DEPLOY.md)

## Branches (قانون قطعی)

| App | Branch | Notes |
|-----|--------|-------|
| **Frontend** | **`main`** | Next.js از پوشه `frontend/` |
| **Backend** | **`beautijoo-backend-export`** | فقط این برنچ برای سرویس بک‌اند لیارا |

### قبل از هر deploy

1. **CI روی `main` سبز** باشد.
2. اگر `backend/` عوض شده → **همگام‌سازی** `main` → `beautijoo-backend-export` (Actions: `sync-backend-export`).
3. لیارا: Redeploy فرانت از `main`، بک‌اند از `beautijoo-backend-export`.
4. کد ناسالم / CI قرمز → **نرود** روی برنچ‌های اصلی و deploy نشود.

## Controlled release (preferred)

1. Wait for **CI** green on `main`.
2. Create tag (optional): Actions → **Create release tag** → e.g. `v1.2.0`.
3. Sync backend export:
   - Actions → **sync-backend-export** (or equivalent Sync backend deployment branch)
4. In Liara:
   - Frontend: deploy from **`main`**
   - Backend: deploy from **`beautijoo-backend-export`**
5. Backend env (required):
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (each ≥32 chars, different)
   - `CORS_ORIGINS=https://beautijoo.ir,https://www.beautijoo.ir`
   - `NODE_ENV=production`
6. Optional product env: `PAYMENT_PROVIDER`, `ZARINPAL_*`, `REMINDERS_*` — see issue **#42**.
7. After backend start: `prisma migrate deploy` if not run by container start.
8. Smoke-test critical paths (login, booking, zibagar services menu).

## Rollback

1. Re-sync export with previous known-good `main` SHA / tag.
2. Redeploy FE + BE together.
3. Do **not** expect DB schema to reverse automatically.

## Do not

- Deploy backend from monorepo **`main`** as the Liara backend branch.
- Deploy frontend from **`beautijoo-backend-export`**.
- Push broken / red-CI code to `main` or export.
- Assume GitHub commit = live site without Liara Redeploy.
- Treat ZIP artifacts as a live deploy.

More detail: `docs/BRANCH_AND_DEPLOY.md`, `docs/CI_CD.md`, `DEPLOYMENT.md`, issue #42.
