# ایشو ۶۲ — هفته ۱ اعتماد و پول (موارد ۱–۱۰)

## ۱. درگاه واقعی
- `PAYMENT_PROVIDER=zarinpal`
- `ZARINPAL_MERCHANT_ID` + `ZARINPAL_SANDBOX=false` روی production
- Callback: `{APP_URL}/payment/callback` در پنل زرین‌پال

## ۲–۴. UX پرداخت و کنسلی
- `/payment/callback` → confirmation با وضعیت
- خلاصه رزرو: خدمت + افزودنی + جمع
- `CancelPolicyNotice` قبل از پرداخت

## ۵–۸. رزرو
- no-show در پنل زیباگر
- `MAX_CONCURRENT_BOOKINGS` (پیش‌فرض ۳)
- ConflictException فارسی برای اسلات تکراری
- اسلات غیرفعال قرمز و disabled

## ۹–۱۰. یادآوری و E2E
- `RemindersService` ۲۴س و ۲س
- `backend/test/bookings/lifecycle.e2e-spec.ts`
