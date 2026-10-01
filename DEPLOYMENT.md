# Beautijoo — Production Deployment Guide

This document describes the current repository state and the target controlled-release architecture (Option B — Balanced).

Do **not** put real secrets in the repository or in ZIP artifacts.

---

## 1. Current State (as of main @ 7baa6eb)

| Component | Stack / Notes |
|-----------|---------------|
| Backend | NestJS + Prisma + PostgreSQL (`/api/v1`) |
| Frontend | Next.js App Router (RTL Persian), `output: 'standalone'` |
| Auth | JWT access + refresh rotation, OTP (SMS provider abstraction) |
| Payments / SMS / Storage | Provider interfaces (mock in dev; real providers via env) |

### Backend deployment path (repository side)

```
main
  → (previously) push to main triggered subtree split
  → beautijoo-backend-export
  → (Liara connection status: NOT VERIFIED — LIARA ACCESS REQUIRED)
```

Backend Docker image (from `backend/Dockerfile`):

- Node 22
- `prisma generate` + `nest build`
- On start: `prisma migrate deploy` → `seed-roles` → `node dist/main.js`
- Port 3000

`backend/liara.json`:

```json
{
  "platform": "docker",
  "port": 3000
}
```

### Frontend deployment path

- Next.js standalone build
- `frontend/liara.json` currently contains only `{ "port": 3000 }`
- No `frontend/Dockerfile`
- Production ZIP artifacts are produced by the workflow `Build & Package Production Artifacts (No Deploy)`
- Actual Liara Frontend service name, branch binding, Auto Deploy status, and deployed SHA: **NOT VERIFIED — LIARA ACCESS REQUIRED**

### Important limitations of the previous model

- Ordinary merges to `main` could update the backend export branch.
- Frontend and Backend could drift in version.
- ZIP artifact was easy to confuse with a real deployment.
- `NEXT_PUBLIC_*` variables are injected at **build time** in Next.js.

---

## 2. Target Architecture — Option B (Balanced)

Goal: controlled releases with version pinning, without redesigning the running production system.

```
                main
                 │
             CI passes
                 │
                 ▼
            Git Tag vX.Y.Z
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
     Backend           Frontend
  (subtree from     (build with
   same tag)         NEXT_PUBLIC_*)
        │                 │
        └────────┬────────┘
                 ▼
          Production Release
```

**Core principles**

- **CI ≠ Build ≠ Deploy**
- **ZIP artifact ≠ Deployment**
- A normal merge to `main` must **not** update the backend deployment branch.
- Only an intentional Git Tag (`v*`) or a manually controlled `workflow_dispatch` with an explicit `ref` may update `beautijoo-backend-export`.
- Frontend and Backend of a release should correspond to the same tag.

### Semantic Versioning

Tags follow:

```
vMAJOR.MINOR.PATCH
```

Examples: `v1.0.0`, `v1.1.0`, `v1.1.1`

- **Major** — breaking API / architectural change
- **Minor** — backward-compatible feature
- **Patch** — bug / security / fix

### Backend export (controlled)

Workflow: `.github/workflows/sync-backend-deploy-branch.yml`

- Triggers **only** on:
  - `push` of tags matching `v*`
  - `workflow_dispatch` **with a required `ref` input**
- Checks out the exact selected ref/tag
- Runs `git subtree split --prefix=backend` from that commit
- Force-pushes **only** to `beautijoo-backend-export`
- Never force-pushes `main` or any other branch

### Frontend build notes

`NEXT_PUBLIC_*` variables are **build-time**:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_NESHAN_API_KEY` (optional — Neshan map tiles; issue #33 / #42)

They must be set to production values **before** `next build`. Changing them later on the host does not update the already-built client bundle.

### Backend runtime environment variables

Never commit real secrets. Required at runtime (host / Liara env UI):

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | yes | `production` |
| `PORT` | yes | Platform-assigned |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | yes | ≥ 32 characters |
| `JWT_REFRESH_SECRET` | yes | ≥ 32 characters, different from access |
| `CORS_ORIGINS` | yes | Exact frontend origin(s) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | no | defaults exist |
| SMS / Payment / Storage providers | no | mock until configured |

Actual values present on Liara: **NOT VERIFIED — LIARA ACCESS REQUIRED**

---

## 3. Build vs Deploy

| Stage | What it does | What it does **not** do |
|-------|--------------|--------------------------|
| CI | Typecheck + build validation | Deploy |
| Build / Package (ZIP workflow) | Produces ZIP artifacts | Deploy to Liara |
| Deploy | Publish a specific release to production | (must be intentional) |

The workflow named **Build & Package Production Artifacts (No Deploy)** only creates artifacts. Uploading a ZIP or connecting a branch in Liara is a separate, operator-controlled step.

---

## 4. Rollback

Rollback is **version/tag based**.

Example:

- Current production intended to be `v1.2.0`
- Problem discovered → roll back to previous known-good tag `v1.1.1`

**Critical rule:**

> **Code rollback ≠ Database rollback**

Backend containers run `prisma migrate deploy` on startup. Reverting application code does **not** reverse schema changes that have already been applied. Future migrations should follow an expand → migrate → contract pattern whenever possible.

Before any rollback, verify:

- Database migration compatibility
- API compatibility between Frontend and Backend of the target tag
- That both FE and BE of the chosen tag are deployed together

---

## 5. Liara status

The following are **not verified** from repository evidence and must not be assumed:

- Frontend service name
- Backend service name
- Whether Auto Deploy is enabled
- Which branch (if any) is bound in Liara
- Actual deployed SHAs
- Environment variable values
- Deployment / rollback history

All of the above: **NOT VERIFIED — LIARA ACCESS REQUIRED**

---

## 6. Practical build commands (for operators)

### Backend (before packaging or Docker build)

```bash
cd backend
npm ci
npx prisma generate
npm run build
```

### Frontend (production values must be set before build)

```bash
cd frontend
export NEXT_PUBLIC_API_URL="https://api.beautijoo.ir/api/v1"
export NEXT_PUBLIC_APP_URL="https://beautijoo.ir"
export NEXT_PUBLIC_APP_NAME="Beautijoo"
# optional — Neshan tiles (platform.neshan.org)
# export NEXT_PUBLIC_NESHAN_API_KEY="..."
npm ci
npm run build
```

---

## 7. Post-deploy checklist (operator)

- [ ] Backend health: `GET /api/v1/health`
- [ ] Frontend loads and can reach the API (no CORS errors)
- [ ] Login / registration path works
- [ ] Booking flow functions end-to-end
- [ ] Confirm the running Frontend and Backend correspond to the same release tag
- [ ] Rotate any seed admin credentials if seed was executed

---

## 8. What this guide deliberately does not claim

- Real Liara service configuration
- Auto Deploy status
- Live environment variable values
- Deployment history or current live SHAs

Those require direct Liara access and remain out of scope for repository documentation until verified.

---

## 9. Technical ops checklist (issue #42)

Short reminders for deploy-time confusion around maps, migrations, roles, and payments. **No application rewrite required** — mostly env + one-time ops.

### 9.1 Neshan map API key (frontend)

For **in-page Neshan tiles** (not only external routing links):

1. Create a web API key at [platform.neshan.org](https://platform.neshan.org).
2. Set on the **frontend** host / Liara **before build**:

```bash
NEXT_PUBLIC_NESHAN_API_KEY=your_key_here
```

3. **Rebuild / redeploy** the frontend (build-time inlining).

Without the key: «مسیریابی با نشان» / «مشاهده در نشان» still work via neshan.org links; in-page map may use temporary OSM tiles.

See also: `frontend/src/lib/neshan.ts`, `frontend/.env.example`.

### 9.2 Database migrate after backend deploy

Backend `npm start` already runs:

```text
prisma-migrate-deploy → seed-roles → seed-catalog → dist/main.js
```

If start does **not** use that script, run once on production DB:

```bash
cd backend
npx prisma migrate deploy
```

Without migrate: new columns/enums (e.g. salon media, social_links) can fail at runtime.

### 9.3 Seed admin channel roles (related to #37)

If channel roles (`admin_customers`, …) are missing on the server:

```bash
cd backend
node prisma/seed-roles.cjs
```

(Also part of normal `npm start`.)

### 9.4 Online payment — Zarinpal (backend)

Already implemented in code. Configure on **backend** Liara env:

```bash
PAYMENT_PROVIDER=zarinpal
ZARINPAL_MERCHANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ZARINPAL_SANDBOX=true          # test: true | production: false or omit
# optional refunds:
# ZARINPAL_ACCESS_TOKEN=
```

- Production without `PAYMENT_PROVIDER=zarinpal` → online payment **disabled** (safe).
- Non-production empty → **mock** payment.

Flow: booking confirmation → `POST /payments/initiate` → gateway → `/payment/callback`.

Templates: `backend/.env.example`.

### 9.5 Operator checklist (issue #42)

- [ ] `NEXT_PUBLIC_NESHAN_API_KEY` on frontend (optional; rebuild after set)
- [ ] Confirm backend start log shows migrate deploy (or run manually)
- [ ] If needed: `node prisma/seed-roles.cjs`
- [ ] Zarinpal env if online payment should be live
- [ ] Smoke: professional workplace map + public profile + Neshan routing button
- [ ] Smoke: booking → pay (sandbox) → callback
