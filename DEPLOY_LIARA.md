# Liara Deploy — Beautijoo

## Branches

| App | Branch | Notes |
|-----|--------|-------|
| **Frontend** | `main` | Next.js |
| **Backend** | `beautijoo-backend-export` | Nest subtree only (no `backend/` prefix) |

## After merging fixes to `main`

1. Wait for **CI** green on `main` (Backend build + Frontend build).
2. Sync backend deploy branch:
   - GitHub → Actions → **Sync backend deployment branch** → Run workflow
   - Input `ref`: commit SHA of the green `main` tip (or a `v*` tag)
3. In Liara:
   - Frontend app: deploy from `main`
   - Backend app: deploy from `beautijoo-backend-export`
4. Backend env (required):
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (each ≥32 chars, different)
   - `CORS_ORIGINS=https://beautijoo.ir,https://www.beautijoo.ir` (exact frontend origins)
   - `NODE_ENV=production`
5. After backend start: `prisma migrate deploy` runs via `npm start`.

## Do not

- Deploy backend from `main` (paths wrong — monorepo root).
- Point Liara backend at a truncated `schema.prisma`.
