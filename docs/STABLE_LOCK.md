# قفل پایدار (Stable Lock)

**تگ:** [`stable-2026-11-06`](https://github.com/tajvidisadegh-pixel/grokrepositorybeautijoo/releases/tag/stable-2026-11-06)  
**تاریخ:** ۲۰۲۶-۱۱-۰۶  
**Commit فرانت (`main`):** `e778494a3ff75122cc70f76e4070172dbccab435`

این سند نقطهٔ بازگشت عمدی است تا دیگر «چیزی که درست کار می‌کرد» با پچ‌های عجولانه خراب نشود.

---

## چه چیزی در این قفل ثابت است؟

- سایت بعد از قطعی Bad Gateway دوباره قابل بالا آمدن است (بوت Nest با SMS/payment ناقص کرش نمی‌کند).
- کنترلر قیمت‌گذاری کاتالوگ ادمین (`AdminCatalogPricingController`) دوباره کامل است و `pricing-flags` بدنه برمی‌گرداند.
- قوانین دیپلوی: فرانت از `main`، بک‌اند از `beautijoo-backend-export` (ریشهٔ `src/`).

---

## قوانین سخت بعد از قفل

1. **مسیرهای حیاتی را بدون تست دستی روی staging/لیارا دست نزنید:**
   - `backend/src/auth/**`
   - `backend/src/sms/**` و `backend/src/payments/**` (منطق بوت)
   - `backend/src/admin/admin-catalog-pricing.controller.ts`
   - `frontend/src/lib/api.ts`
2. **فایل را با PLACEHOLDER یا محتوای خالی بازنویسی نکنید.**
3. همگام‌سازی بک‌اند = کپی `main/backend/src` → **`beautijoo-backend-export/src`** (نه فقط `backend/` تو در تو).
4. قبل از merge/push بزرگ: CI سبز؛ بعد از deploy بک‌اند، یک smoke: لاگین، لیست تخصص ادمین، یک بار ذخیره قیمت‌گذاری.
5. اگر رگرسیون جدی رخ داد: به تگ `stable-2026-11-06` برگردید و Redeploy کنید.

---

## بازگشت اضطراری

```bash
git fetch origin tag stable-2026-11-06
git checkout stable-2026-11-06
# لیارا: Deploy از همین تگ / commit
```

بک‌اند:

```bash
git fetch origin beautijoo-backend-export
# deploy branch beautijoo-backend-export در وضعیت هم‌تراز با قفل
```

---

## به‌روزرسانی قفل

فقط وقتی عمداً نسخهٔ پایدار جدید اعلام می‌شود: تگ جدید `stable-YYYY-MM-DD` + به‌روزرسانی همین فایل. تا آن موقع این تگ مرجع «آخرین نسخهٔ سالم شناخته‌شده» است.
