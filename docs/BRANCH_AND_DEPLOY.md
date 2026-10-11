# قانون برنچ و استقرار لیارا (الزامی)

این سند **مرجع رسمی** است. هر تغییر استقرار یا برنچ باید با این قوانین سازگار باشد تا دوباره کد روی GitHub باشد ولی روی سایت دیده نشود.

---

## ۱) برنچ‌ها — فقط این دو مسیر

| سرویس لیارا | برنچ GitHub | مسیر کد در monorepo |
|-------------|-------------|---------------------|
| **فرانت (Next.js)** | **`main`** | `frontend/` |
| **بک‌اند (NestJS)** | **`beautijoo-backend-export`** | `backend/` روی `main` → باید به برنچ export همگام شود |

### ممنوع

- دیپلوی **بک‌اند** از `main`.
- دیپلوی **فرانت** از `beautijoo-backend-export`.
- پوش مستقیم به `main` یا export وقتی CI قرمز است.
- فرض اینکه «کامیت روی main = روی سایت آمده» بدون Redeploy لیارا.

---

## ۲) کد حتماً سالم باشد قبل از برنچ اصلی

1. CI روی GitHub **سبز**.
2. Merge/push به **`main`**.
3. اگر `backend/` عوض شد → همگام **`beautijoo-backend-export`**.
4. Redeploy لیارا (فرانت از main، بک‌اند از export).
5. migration در صورت نیاز.

---

## ۳) ترتیب deploy فرانت و بک‌اند (مهم)

```
۱) بک‌اند بالا و /health سالم
۲) فرانت بیلد با NEXT_PUBLIC_API_URL درست
۳) اگر Collecting page data > ۲۰ دقیقه → Cancel، API را چک کن
```

صفحات SSR/sitemap در **زمان بیلد** به API درخواست می‌زنند. اگر API نباشد، بیلد می‌تواند روی `Collecting page data` آویزان شود.

- همهٔ این درخواست‌ها باید از `frontend/src/lib/public-api.ts` با **timeout** بروند.
- جزئیات و علائم لاگ: **README.md** بخش «هشدار استقرار فرانت».

---

## ۴) همگام‌سازی بک‌اند

بعد از تغییر `backend/` روی `main`:

- Actions → workflow **`sync-backend-export`**

---

## ۵) Env حداقل

ایشو **#42** و `DEPLOY_LIARA.md`.

فرانت بیلد: `NEXT_PUBLIC_API_URL` = آدرس واقعی API production.

---

## ۶) برای عامل‌ها / Grok / PR

- کار روی `main` در مسیرهای `frontend/` و `backend/`.
- بعد از backend → sync export.
- «انجام شد روی سایت» فقط بعد از deploy + تست دستی.
- **هرگز** fetch بدون timeout به API در مسیر بیلد (RSC / sitemap / generateMetadata) اضافه نکن.

**مرتبط:** `README.md` · `DEPLOY_LIARA.md` · `DEPLOYMENT.md` · Issue #42
