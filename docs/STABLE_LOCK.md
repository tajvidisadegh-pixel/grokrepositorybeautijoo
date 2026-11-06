# قفل پایدار سخت (Hard Stable Lock)

**تگ قفل:** `stable-2026-11-06`  
**Commit مرجع `main`:** `e778494a3ff75122cc70f76e4070172dbccab435`  
**تاریخ قفل:** ۲۰۲۶-۱۱-۰۶

این سند **قانون الزامی** پروژه Beautijoo است. نقض آن معادل پذیرش ریسک قطعی production است.

---

## ۱. حفاظت GitHub (فعال)

| هدف | قانون |
|-----|--------|
| برنچ `main` | حذف برنچ ممنوع · force-push ممنوع |
| برنچ `beautijoo-backend-export` | حذف برنچ ممنوع · force-push ممنوع |
| تگ‌های `stable-*` | حذف تگ ممنوع · بازنویسی تگ ممنوع |

اگر Ruleset خطا داد یا دور زده شد، اول Ruleset را درست کنید؛ تاریخچهٔ قفل را پاک نکنید.

---

## ۲. قوانین قرمز — هرگز

1. **هرگز** فایلی را با `PLACEHOLDER`، رشتهٔ خالی، یا «موقت تا بعداً» جایگزین محتوای واقعی نکنید.
2. **هرگز** بدون فهم علت اصلی، باگ production را فقط از فرانت مخفی نکنید.
3. **هرگز** در production برای SMS یا Payment از `FATAL` + کرش کل Nest استفاده نکنید؛ از `disabled` استفاده شود تا سایت بالا بماند.
4. **هرگز** فقط پوشهٔ `backend/` داخل export را آپدیت نکنید؛ لیارا از **`src/` ریشهٔ** `beautijoo-backend-export` بیلد می‌گیرد.
5. **هرگز** force-push روی `main` یا `beautijoo-backend-export` نزنید.
6. **هرگز** تگ `stable-*` را جابه‌جا یا حذف نکنید؛ قفل جدید = تگ جدید با تاریخ جدید.
7. **هرگز** migration مخرب که دادهٔ کاربر/رزرو/زیباگر را پاک کند بدون بکاپ و تأیید صریح.

---

## ۳. مسیرهای حیاتی (تغییر بدون چک‌لیست ممنوع)

هر PR/کامیت که این مسیرها را لمس کند **باید** چک‌لیست بخش ۴ را پاس کند:

### Backend
- `backend/src/main.ts`
- `backend/src/config/**`
- `backend/src/auth/**`
- `backend/src/sms/**`
- `backend/src/payments/**`
- `backend/src/bookings/**`
- `backend/src/admin/admin-catalog*.ts`
- `backend/src/admin/admin-catalog-pricing.controller.ts`
- `backend/prisma/schema.prisma` و `prisma/migrations/**`
- `scripts/prisma-migrate-deploy.cjs`

### Frontend
- `frontend/src/lib/api.ts` و `frontend/src/lib/api-errors.ts`
- `frontend/src/contexts/auth-context.tsx`
- `frontend/src/components/admin/ServicePricingPanel.tsx`
- `frontend/src/app/admin/service-categories/**`
- `frontend/src/components/booking/**`
- `frontend/src/components/layout/**` (فوتر/هدر سراسری)

---

## ۴. چک‌لیست اجباری قبل از Deploy

- [ ] CI روی همان commit سبز است (یا علت قرمز مشخص و پذیرفته شده است).
- [ ] علت تغییر در یک جمله نوشته شده (نه «فیکس»).
- [ ] فایل حیاتی با diff کامل بازبینی شده؛ جایگزینی کل فایل بدون دلیل ممنوع.
- [ ] اگر API عوض شده: فرانت و بک‌اند **هم‌نسخه** deploy می‌شوند.
- [ ] اگر export بک‌اند: محتوا در **`beautijoo-backend-export/src`** است نه فقط `backend/` تو در تو.
- [ ] Smoke بعد از deploy:
  1. باز شدن صفحهٔ اصلی بدون 502
  2. لاگین / ارسال OTP (یا خطای واضح SMS disabled — نه مرگ کل API)
  3. `/admin/service-categories` لود می‌شود
  4. یک بار «قیمت‌گذاری» → ذخیره حالت‌ها بدون خطا
  5. یک مسیر رزرو عمومی که قبلاً کار می‌کرد هنوز باز می‌شود

اگر حتی یک مورد fail شد: **Redeploy به `stable-2026-11-06`** تا تشخیص تمام شود.

---

## ۵. قوانین برای عامل / خودکارسازی (Grok، Actions، اسکریپت)

1. قبل از هر تغییر گسترده: خواندن این فایل + وضعیت فعلی `main`.
2. ممنوع: `push_files` با محتوای ساختگی یا تک‌کلمه به‌جای کل ماژول.
3. ممنوع: خاموش کردن تست یا workflow برای سبز نشان دادن دروغین.
4. بعد از هر تغییر بک‌اند production-path: همگام‌سازی صریح export ریشه + یادآوری Redeploy لیارا.
5. اگر نمی‌دانی علت ریشه‌ای چیست: **متوقف شو** و گزارش بده؛ پچ شانسی ممنوع.
6. پس از تثبیت یک نسخهٔ سالم جدید: فقط با تگ `stable-YYYY-MM-DD` جدید قفل را جلو ببر؛ تگ قبلی را پاک نکن.

---

## ۶. دیپلوی استاندارد

| لایه | منبع | یادداشت |
|------|------|----------|
| فرانت | برنچ `main` یا تگ `stable-*` | بعد از تغییر UI ادمین/رزرو حتماً Redeploy |
| بک‌اند | برنچ `beautijoo-backend-export` | بیلد از `src/` ریشه؛ env: `CORS_ORIGINS`, JWTها, `DATABASE_URL` |

Env پیشنهادی production (حداقلی برای زنده ماندن):
- `CORS_ORIGINS=https://beautijoo.ir`
- JWT secrets قوی و متفاوت
- `SMS_PROVIDER=smsir` + کلیدها **یا** پذیرش disabled (سایت بالا، OTP قطع)
- `PAYMENT_PROVIDER=zarinpal` + merchant **یا** disabled

---

## ۷. بازگشت اضطراری

```bash
git fetch origin tag stable-2026-11-06
git checkout stable-2026-11-06
```

لیارا:
1. فرانت → Deploy از تگ / commit قفل
2. بک‌اند → `beautijoo-backend-export` در وضعیت هم‌تراز قفل
3. Smoke بخش ۴

---

## ۸. به‌روزرسانی قفل (فقط آگاهانه)

شرایط اجازهٔ تگ پایدار جدید:
1. حداقل ۲۴ ساعت بدون رگرسیون بحرانی روی production، **یا** تأیید صریح مالک.
2. CI سبز.
3. چک‌لیست بخش ۴ کامل.
4. ایجاد تگ جدید `stable-YYYY-MM-DD` + به‌روزرسانی همین فایل با commit جدید.
5. تگ‌های قبلی را حذف نکنید (تاریخچهٔ قفل).

---

**اصل یک‌خطی:** چیزی که برای کاربر کار می‌کند را برای «تمیزکاری» یا «رفکتور عجله‌ای» قربانی نکن؛ اول ثبات، بعد زیبایی کد.
