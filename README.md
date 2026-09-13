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
└── README.md
```

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
| Secondary (navy) | `#374989` |
| Neutral gray | `#808080` |
| White | `#FFFFFF` |

لوگو: فقط مرجانی (بدون navy داخل نشان).

## عیب‌یابی لیارا (دیتابیس)

اگر پیام «ناسازگاری موقت دیتابیس» دیدید:

- **[docs/LIARA_SCHEMA_DRIFT.md](./docs/LIARA_SCHEMA_DRIFT.md)**
- معمولاً با **Redeploy بکند** (اجرای migrate/ensure روی استارت) حل می‌شود — نه با تغییر فرانت.

## شروع سریع (توسعه)

### پیش‌نیازها
- **Bun** (نسخه ۱.۱ یا بالاتر) — نصب:
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- Node.js 20+ (اختیاری؛ برای سازگاری و برخی ابزارها)
- PostgreSQL 15+
- Git

> در ریشه پروژه `bun.lock` وجود دارد. برای توسعه محلی دستورات Bun اولویت دارند.

### Backend
```bash
cd backend
cp .env.example .env
# تنظیم DATABASE_URL و JWT_SECRET
bun install
bunx prisma migrate dev
bunx prisma db seed
bun run start:dev
```

### Frontend
```bash
cd frontend
cp .env.example .env.local
# تنظیم NEXT_PUBLIC_API_URL
bun install
bun run dev
```

### از ریشه پروژه (workspaces)
```bash
bun install
bun run backend:dev   # یا: cd backend && bun run start:dev
bun run frontend:dev  # یا: cd frontend && bun run dev
```

## مستندات
- [DEPLOYMENT.md](./DEPLOYMENT.md) — راهنمای استقرار (از جمله Liara)
- [docs/FRONTEND_DESIGN_SYSTEM.md](./docs/FRONTEND_DESIGN_SYSTEM.md) — سیستم طراحی فرانت
- [docs/LIARA_SCHEMA_DRIFT.md](./docs/LIARA_SCHEMA_DRIFT.md) — خطای schema drift روی لیارا
- `docs/` — معماری، اسکیما، امنیت

## لایسنس
Proprietary — Beautijoo
