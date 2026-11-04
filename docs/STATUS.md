> **منسوخ (obsolete)** — این فایل مربوط به فازهای ابتدای پروژه است و وضعیت فعلی را نشان نمی‌دهد.
>
> برای وضعیت به‌روز پروژه ببینید: **[CURRENT_STATUS.md](./CURRENT_STATUS.md)**

---

# Beautijoo Status (archived)

## Completed Phases (historical)
- Phase 0: Architecture approved
- Phase 1: Repository structure & tooling
- Phase 2: Full Prisma schema + migrations + seed roles + double-booking prevention
- Phase 3: Backend foundation (Config, Prisma, Health, Swagger, filters)
- Phase 4: Authentication & Authorization (JWT + Refresh + OTP-ready + RBAC)

## Next (at time of writing — no longer accurate)
- Phase 5: Professional / services / locations modules
- Phase 6: Booking & availability engine

## Auth endpoints (may still exist; not a status source)
- POST /api/v1/auth/register
- POST /api/v1/auth/login
- POST /api/v1/auth/otp/request
- POST /api/v1/auth/otp/verify
- POST /api/v1/auth/refresh
- POST /api/v1/auth/logout
- GET  /api/v1/auth/me
