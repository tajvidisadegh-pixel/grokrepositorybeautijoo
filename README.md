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

## هشدار استقرار فرانت — گیر کردن روی `Collecting page data`

### اشتباه رایج (یک ساعت «در حال ساختن»)

لاگ شبیه این **خطا نیست** و بیلد را معمولاً متوقف نمی‌کند:

```text
Warning: 'x' is assigned a value but never used
…
info - Need to disable some ESLint rules?
Collecting page data ...
```

اگر ساعت‌ها روی **`Collecting page data`** بماند، علت تقریباً همیشه این است:

| علت | توضیح |
|-----|--------|
| API در بیلد در دسترس نیست / کند است | صفحهٔ اصلی، sitemap، دسته و … در build به `NEXT_PUBLIC_API_URL` درخواست می‌زنند |
| آدرس API اشتباه در env بیلد لیارا | مثلاً localhost یا دامنهٔ قدیمی |
| بک‌اند هنوز deploy / سالم نیست | فرانت را قبل از API پایدار بیلد نکنید |

### قانون تا دوباره پیش نیاید

1. **اول بک‌اند** روی `beautijoo-backend-export` بالا و سالم باشد؛ **بعد** بیلد فرانت.
2. در لیارا فرانت حتماً:
   ```text
   NEXT_PUBLIC_API_URL=https://api.beautijoo.ir/api/v1
   ```
   (آدرس واقعی production — نه localhost)
3. درخواست‌های public در بیلد **timeout** دارند (`frontend/src/lib/public-api.ts`، حدود ۱۲ث). اگر بیلد باز هم >۱۵–۲۰ دقیقه روی Collecting ماند → **Cancel** و API/env را چک کن؛ صبر یک‌ساعته فایده ندارد.
4. Warningهای ESLint را با hang اشتباه نگیر؛ بعد از lint باید `Collecting page data` / `Compiling` / `Build finished` بیاید.
5. هر `fetch` سمت سرور برای صفحهٔ عمومی باید از `@/lib/public-api` با timeout برود — **fetch بدون timeout به API در RSC/sitemap ممنوع**.

### اگر بیلد گیر کرد

1. Cancel در لیارا  
2. سلامت `GET {API}/health` را چک کن  
3. env بیلد فرانت را چک کن  
4. Redeploy از **`main`** بعد از سبز بودن CI  

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
