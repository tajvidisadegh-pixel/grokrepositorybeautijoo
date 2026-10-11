# Liara Deploy — Beautijoo

> **مرجع فارسی و الزامی برنچ:** [`docs/BRANCH_AND_DEPLOY.md`](./docs/BRANCH_AND_DEPLOY.md)  
> **۵۰۲ / next module و Collecting page data:** [`README.md`](./README.md)

## Branches (قانون قطعی)

| App | Branch | Notes |
|-----|--------|-------|
| **Frontend** | **`main`** | Next.js از پوشه `frontend/` |
| **Backend** | **`beautijoo-backend-export`** | فقط این برنچ برای سرویس بک‌اند لیارا |

### قبل از هر deploy

1. **CI روی `main` سبز** باشد.
2. اگر `backend/` عوض شده → **همگام‌سازی** `main` → `beautijoo-backend-export`.
3. لیارا: Redeploy فرانت از `main`، بک‌اند از `beautijoo-backend-export`.
4. کد ناسالم / CI قرمز → **نرود** روی برنچ‌های اصلی.

## Frontend Docker (ضد ۵۰۲ `Cannot find module 'next'`)

- Dockerfile: `frontend/Dockerfile`
- Build context: پوشه **`frontend/`**
- Start command در لیارا: **خالی** یا فقط `node server.js`
- **ممنوع:** `node standalone/server.js` یا `/app/standalone/server.js`
- Port: `3000`

اگر لاگ runtime این را نشان داد، Start path اشتباه است یا image ناقص:

```text
Error: Cannot find module 'next'
Require stack: - /app/standalone/server.js
```

## Controlled release

1. CI green on `main`.
2. Sync backend export if needed.
3. Liara: FE=`main`, BE=`beautijoo-backend-export`.
4. Backend env: `DATABASE_URL`, JWT secrets, `CORS_ORIGINS`, `NODE_ENV=production`.
5. Optional: `PAYMENT_PROVIDER`, `REMINDERS_*` — issue **#42**.
6. Smoke: login, booking, zibagar services.

## Do not

- Deploy backend from **`main`** as Liara backend branch.
- Deploy frontend from **`beautijoo-backend-export`**.
- Start frontend with `node standalone/server.js`.
- Assume GitHub commit = live site without Redeploy.

More: `docs/BRANCH_AND_DEPLOY.md`, `README.md`, issue #42.
