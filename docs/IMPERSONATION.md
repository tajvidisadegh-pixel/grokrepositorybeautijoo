# Customer impersonation (issue #22)

## Who

Only role `SUPER_ADMIN` may call `POST /admin/users/:id/impersonate`.

## How

- Issues a **short-lived access token only** (`sub` = customer, claims `imp` + `impMode`).
- Does **not** rotate the `bj_refresh` cookie (admin session preserved).
- Effective roles come from the customer user in DB; RolesGuard denies admin bypass while `isImpersonating`.
- Frontend stores admin access token in `sessionStorage` and restores on «بازگشت به حساب مدیر».
- Audit: `IMPERSONATION_STARTED` / `IMPERSONATION_ENDED` via existing `audit_logs`.

## Never

- Password or passwordHash is never returned.
- Cannot impersonate SUPER_ADMIN / admin accounts.
