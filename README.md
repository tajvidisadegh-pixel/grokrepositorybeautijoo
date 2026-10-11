# Beautijoo

پلتفرم مارکت‌پلیس و رزرو نوبت برای زیباگران (Beauty Professionals) — فارسی و RTL.

## ساختار پروژه

```
beautijoo/
├── backend/
├── frontend/
├── Dockerfile          # ایمیج فرانت وقتی لیارا به root ریپو وصل است
├── frontend/Dockerfile # وقتی root directory لیارا = frontend/
├── docs/
├── DEPLOY_LIARA.md
└── README.md
```

## قانون برنچ و لیارا

| سرویس | برنچ |
|--------|------|
| فرانت | **`main`** |
| بک‌اند | **`beautijoo-backend-export`** |

مرجع: [docs/BRANCH_AND_DEPLOY.md](./docs/BRANCH_AND_DEPLOY.md)

---

## ۵۰۲ — `Cannot find module 'next'` (لاگ: `/app/standalone/server.js`)

### علت واقعی در این پروژه

لیارا وقتی به **ریشهٔ ریپو** وصل است از **`Dockerfile` ریشه** بیلد می‌گیرد (نه فقط `frontend/Dockerfile`).

قبلاً بیلد با **npm workspaces** باعث می‌شد `next` به root hoist شود و داخل پوشهٔ `standalone` کپی نشود. موقع اجرا:

```text
node /app/standalone/server.js  →  Error: Cannot find module 'next'  →  502
```

### قانون (در Dockerfile ریشه رعایت شده)

1. فرانت **جدا** install/build می‌شود (بدون workspace hoist).
2. `server.js` و `node_modules/next` کنار هم هستند.
3. همان درخت زیر **`/app/standalone/`** هم mirror می‌شود تا اگر Start لیارا `standalone/server.js` باشد باز هم `next` پیدا شود.
4. دستور ترجیحی: `node server.js` — اگر Start دستی داری، یا خالی بگذار یا همین.

### بعد از این فیکس

Deploy دوباره از **`main`** (کامیت‌هایی که Dockerfile ریشه را اصلاح کرده‌اند). اگر Start سفارشی `node standalone/server.js` است، با image جدید باید کار کند؛ ترجیحاً Start را خالی کن.

---

## `Collecting page data` طولانی

اول API بالا باشد؛ `NEXT_PUBLIC_API_URL` واقعی؛ بیش از ۲۰ دقیقه Cancel. جزئیات در بخش قبلی README / public-api timeout.

---

## استقرار

1. [docs/BRANCH_AND_DEPLOY.md](./docs/BRANCH_AND_DEPLOY.md)
2. [DEPLOY_LIARA.md](./DEPLOY_LIARA.md)
