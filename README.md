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

## قانون برنچ و لیارا (بخوانید)

**مرجع رسمی:** [docs/BRANCH_AND_DEPLOY.md](./docs/BRANCH_AND_DEPLOY.md)

| سرویس | برنچ |
|--------|------|
| فرانت لیارا | `main` |
| بک‌اند لیارا | `beautijoo-backend-export` |

- فقط کد با **CI سبز** وارد `main` شود.
- بعد از تغییر `backend/` حتماً export را همگام کنید، بعد Redeploy لیارا.
- کامیت روی GitHub به‌تنهایی سایت را عوض نمی‌کند.

جزئیات بیشتر: [DEPLOY_LIARA.md](./DEPLOY_LIARA.md) · ایشو فنی #42

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

قبل از هر تغییر ظاهری، این سند را بخوانید:

- **[docs/FRONTEND_DESIGN_SYSTEM.md](./docs/FRONTEND_DESIGN_SYSTEM.md)** — رنگ‌ها، لوگو، توکن‌ها، کامپوننت‌ها، RTL
- مرجع موکاپ: Issue **#68**

خلاصه پالت:

| نقش | رنگ |
|-----|-----|
| Primary (coral) | `#fc7074` |

## توسعه محلی

راهنمای نصب و اجرا در مستندات `docs/` و اسکریپت‌های ریشهٔ پروژه.

## استقرار

1. [docs/BRANCH_AND_DEPLOY.md](./docs/BRANCH_AND_DEPLOY.md)
2. [DEPLOY_LIARA.md](./DEPLOY_LIARA.md)
3. [DEPLOYMENT.md](./DEPLOYMENT.md)
