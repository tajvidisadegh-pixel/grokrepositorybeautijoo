# Beautijoo

پلتفرم مارکت‌پلیس و رزرو نوبت برای زیباگران (Beauty Professionals) — فارسی و RTL.

## ساختار پروژه

```
beautijoo/
├── backend/          # NestJS + Prisma + PostgreSQL
├── frontend/         # Next.js App Router (RTL, Persian)
├── docs/             # مستندات معماری، ERD، امنیت، طراحی فرانت
├── scripts/          # اسکریپت‌های کمکی
├── docker/           # Docker Compose برای توسعه محلی
├── DEPLOYMENT.md     # راهنمای استقرار
├── DEPLOY_LIARA.md   # استقرار لیارا (خلاصه)
└── README.md
```

## قانون برنچ و لیارا (الزامی)

**مرجع رسمی:** [docs/BRANCH_AND_DEPLOY.md](./docs/BRANCH_AND_DEPLOY.md)

| سرویس | برنچ |
|--------|------|
| فرانت لیارا | **`main`** |
| بک‌اند لیارا | **`beautijoo-backend-export`** |

- فقط کد با **CI سبز** وارد `main` شود.
- بعد از تغییر `backend/` حتماً export را همگام کنید، بعد Redeploy لیارا.
- کامیت روی GitHub به‌تنهایی سایت را عوض نمی‌کند.

جزئیات: [DEPLOY_LIARA.md](./DEPLOY_LIARA.md) · ایشو فنی #42

---

## هشدار استقرار فرانت — ۵۰۲ و `Cannot find module 'next'`

### علامت در لاگ runtime لیارا

```text
Error: Cannot find module 'next'
Require stack: - /app/standalone/server.js
```

یا سایت **۵۰۲ Bad Gateway** بعد از deploy «موفق».

### علت

Next با `output: 'standalone'` باید این‌طور اجرا شود:

```text
WORKDIR = جایی که server.js و node_modules (شامل next) کنار هم‌اند
دستور: node server.js
```

اگر دستور استارت این باشد، **module resolution می‌شکند**:

```text
node standalone/server.js     ← ممنوع
node /app/standalone/server.js  ← ممنوع
```

چون `next` نسبت به مسیر اشتباه resolve می‌شود و پروسه کرش می‌کند → پروکسی لیارا **۵۰۲** می‌دهد.

### قانون تا دوباره پیش نیاید

1. **Dockerfile فرانت:** `frontend/Dockerfile` — در image نهایی `server.js` در `/app/server.js` باشد.
2. **دستور Start در لیارا:** خالی بگذار تا همان `CMD` داکر اجرا شود، یا فقط:
   ```text
   node server.js
   ```
3. **هرگز** Start دستی `node standalone/server.js` نگذار.
4. **Build context** باید پوشهٔ **`frontend/`** باشد (نه root کل monorepo)، مگر Dockerfile مخصوص root نوشته شده باشد.
5. پورت سرویس: **3000**.
6. بیلد ایمیج اگر `next` داخل standalone نباشد باید **همان‌جا fail** شود (چک داخل Dockerfile) تا به runtime نرسد.

### اگر دوباره ۵۰۲ دیدی

1. لاگ runtime را برای `Cannot find module 'next'` چک کن.
2. Start Command لیارا را اصلاح/پاک کن.
3. از `main` با `frontend/Dockerfile` دوباره Deploy کن.

---

## هشدار استقرار فرانت — گیر کردن روی `Collecting page data`

### اشتباه رایج (یک ساعت «در حال ساختن»)

لاگ شبیه این **خطا نیست** و بیلد را معمولاً متوقف نمی‌کند:

```text
Warning: 'x' is assigned a value but never used
…
Collecting page data ...
```

اگر ساعت‌ها روی **`Collecting page data`** بماند:

| علت | توضیح |
|-----|--------|
| API در بیلد در دسترس نیست / کند است | صفحهٔ اصلی، sitemap و … به `NEXT_PUBLIC_API_URL` درخواست می‌زنند |
| آدرس API اشتباه در env بیلد | مثلاً localhost |
| بک‌اند هنوز بالا نیست | اول API، بعد فرانت |

### قانون

1. اول بک‌اند سالم؛ بعد بیلد فرانت.
2. `NEXT_PUBLIC_API_URL=https://api.beautijoo.ir/api/v1` (آدرس واقعی).
3. timeout در `frontend/src/lib/public-api.ts` (~۱۲ث). بیش از ۲۰ دقیقه روی Collecting → **Cancel**.
4. fetch بدون timeout در RSC/sitemap ممنوع.

---

## تکنولوژی‌ها

| لایه       | تکنولوژی                          |
|------------|-----------------------------------|
| Frontend   | Next.js (App Router), TypeScript, Tailwind, RTL |
| Backend    | NestJS, TypeScript, Prisma        |
| Database   | PostgreSQL                        |
| Auth       | JWT + Refresh Token + OTP-ready   |
| API        | REST `/api/v1` + Swagger          |
| Runtime / PM | Bun (اصلی) + Node.js 20+ (سازگاری) |

## طراحی فرانت (الزامی برای هر تغییر UI)

- **[docs/FRONTEND_DESIGN_SYSTEM.md](./docs/FRONTEND_DESIGN_SYSTEM.md)**
- مرجع موکاپ: Issue **#68**

| نقش | رنگ |
|-----|-----|
| Primary (coral) | `#fc7074` |

## توسعه محلی

راهنمای نصب و اجرا در `docs/` و اسکریپت‌های ریشه.

## استقرار

1. [docs/BRANCH_AND_DEPLOY.md](./docs/BRANCH_AND_DEPLOY.md)
2. [DEPLOY_LIARA.md](./DEPLOY_LIARA.md)
3. [DEPLOYMENT.md](./DEPLOYMENT.md)
