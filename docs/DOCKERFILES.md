# Dockerfiles — intentional dual targets (#82.20)

| Path | Purpose | Build context |
|------|---------|---------------|
| `Dockerfile` (repo root) | Frontend image when Liara/Git connects at **repo root** | copies `frontend/` |
| `frontend/Dockerfile` | Frontend image when build context is **`frontend/`** | local to frontend |
| `backend/Dockerfile` | Backend NestJS image (Liara backend / export branch) | `backend/` |

They are **not** duplicates. Prefer the path that matches the platform build context.

Canonical deploy rules: `docs/BRANCH_AND_DEPLOY.md` · `DEPLOY_LIARA.md` · `DEPLOYMENT.md`.
