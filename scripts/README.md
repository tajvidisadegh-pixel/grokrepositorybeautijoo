# Scripts

اسکریپت‌های کمکی برای توسعه و عملیات محلی Beautijoo.

| فایل | کاربرد |
|------|--------|
| `dev-up.sh` | بالا آوردن Postgres + نصب + migrate + seed + اجرای همزمان backend و frontend |
| `db-reset.sh` | ریست کامل دیتابیس توسعه (حذف volume + migrate + seed) |
| `check-env.sh` | بررسی وجود متغیرهای ضروری `.env` قبل از اجرا |
| `generate-secrets.sh` | تولید `JWT_ACCESS_SECRET` و `JWT_REFRESH_SECRET` امن |

همه اسکریپت‌ها از **ریشه پروژه** اجرا شوند:

```bash
./scripts/dev-up.sh
```
