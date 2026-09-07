# Super Admin access (secure)

Do **not** put phone/password in git or frontend code.

## 1) Seed / promote SUPER_ADMIN for your account

From `backend/` with a working `DATABASE_URL`:

```bash
npx prisma generate
SUPER_ADMIN_PHONE=0912xxxxxxx SUPER_ADMIN_PASSWORD='your-strong-password' node prisma/seed-super-admin.cjs
```

Optional display name:

```bash
SUPER_ADMIN_PHONE=0912xxxxxxx SUPER_ADMIN_PASSWORD='your-strong-password' SUPER_ADMIN_DISPLAY_NAME='مدیر کل' node prisma/seed-super-admin.cjs
```

## 2) Login

1. Open `/login`
2. Use the same phone + password
3. Go to `/admin`

Only users with role `SUPER_ADMIN` can use admin APIs and the admin panel UI.
