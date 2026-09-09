# Prisma migrations

## Production path

On container start (Dockerfile / `npm start`):

```bash
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

**Do not** use `prisma db push --accept-data-loss` against staging or production.

## Linear history

Migrations live under `backend/prisma/migrations/` and must apply cleanly on an **empty** Postgres database in order.

The duplicate `20260909093000_account_type_separation` was removed; the canonical change is:

- `20260909090000_account_type_separation`

If a database already has a row for the removed migration in `_prisma_migrations`, either:

1. Prefer restoring from a DB that only applied the linear set, or
2. Manually delete that orphan row only after confirming schema already matches `20260909090000` (phone + account_type unique, etc.).

## Local / CI

```bash
# empty DB
npx prisma migrate deploy --schema=./prisma/schema.prisma
node prisma/seed-roles.cjs
```

E2E and unit test helpers use `migrate deploy`, not `db push`.
