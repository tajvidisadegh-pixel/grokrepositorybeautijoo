# Liara Deploy — Beautijoo

## Branches

| App | Branch | Notes |
|-----|--------|-------|
| **Frontend** | `main` (or same release tag) | Next.js |
| **Backend** | `beautijoo-backend-export` | Nest subtree only (no `backend/` prefix) |

## Controlled release (preferred)

1. Wait for **CI** green on `main`.
2. Create tag: Actions → **Create release tag** → e.g. `v1.2.0`.
3. Sync backend export (automatic on `v*` tag, or):
   - Actions → **Sync backend deployment branch** → Run workflow
   - Input `ref`: `v1.2.0` (or green commit SHA)
4. In Liara:
   - Frontend: deploy from `main` / tag
   - Backend: deploy from `beautijoo-backend-export`
5. Backend env (required):
   - `DATABASE_URL`
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (each ≥32 chars, different)
   - `CORS_ORIGINS=https://beautijoo.ir,https://www.beautijoo.ir`
   - `NODE_ENV=production`
6. After backend start: `prisma migrate deploy` runs via `npm start`.
7. Smoke: Actions → **Post-deploy smoke** with production API/app URLs.

## Rollback

1. Re-sync export with previous tag: `ref=vX.Y.Z` (known good).
2. Redeploy FE + BE for that tag together.
3. Run post-deploy smoke.
4. Do **not** expect DB schema to reverse automatically.

## Do not

- Deploy backend from monorepo `main` (paths wrong).
- Point Liara backend at a truncated `schema.prisma`.
- Treat ZIP artifacts as a live deploy.
- Rely on ordinary merges to `main` to update `beautijoo-backend-export` (disabled as of 18.15).

More detail: `docs/CI_CD.md`, `DEPLOYMENT.md`.
