# CI/CD & release stability (gap 18.15)

## Stable workflows (keep)

| Workflow | Purpose |
|----------|--------|
| `ci.yml` | PR/push to `main`: backend build + unit + e2e, frontend typecheck/lint/build |
| `codeql.yml` | Security analysis |
| `sync-backend-deploy-branch.yml` | Export `backend/` → `beautijoo-backend-export` on **`v*` tags** or **manual dispatch** only |
| `create-release-tag.yml` | Create annotated `vX.Y.Z` tags |
| `production-zips.yml` | ZIP artifacts on **tag** or **manual** (not every push to main) |
| `post-deploy-smoke.yml` | Operator smoke: health + public list + frontend HTTP 200 |
| `emergency-restore-schema.yml` | Emergency schema recovery (manual) |
| `cleanup-ad-hoc-workflows.yml` | One-shot purge of temporary apply/fix/restore workflows (safe to re-run) |

Temporary `apply-*` / `fix-*` / `restore-*` / `patch-*` workflows used during gap implementation were **removed** by `scripts/cleanup_ad_hoc_workflows.py` (~70 files).

## Release flow (Option B)

```
main (CI green)
  → Create release tag vX.Y.Z (workflow_dispatch)
  → sync-backend-deploy-branch (tag push or manual ref=vX.Y.Z)
  → Liara: frontend from main/tag; backend from beautijoo-backend-export
  → post-deploy-smoke (manual)
```

**Rules**

- Merge to `main` ≠ deploy.
- ZIP artifact ≠ deploy.
- Frontend and backend of a release should share the same tag SHA.

## Post-deploy smoke

Actions → **Post-deploy smoke** → Run workflow:

- `api_base`: e.g. `https://api.beautijoo.ir/api/v1`
- `app_url`: e.g. `https://beautijoo.ir`

Checks: `GET /health`, `GET /professionals?limit=1`, frontend `/` → HTTP 200.

## Rollback

1. Identify last known-good tag (e.g. `v1.1.1`).
2. Re-run **Sync backend deployment branch** with `ref=v1.1.1`.
3. Redeploy frontend from the same tag/commit.
4. Run **Post-deploy smoke**.

**Code rollback ≠ database rollback.** `prisma migrate deploy` does not reverse applied migrations. Prefer expand → migrate → contract for schema changes.

See also `DEPLOYMENT.md` §4 and `DEPLOY_LIARA.md`.

## Dependabot strategy

- Weekly (Monday) PRs for `/backend` and `/frontend` npm, plus GitHub Actions.
- Group **minor + patch**; **major** Nest/Next/React/Prisma ignored (manual upgrade PR).
- Limit open PRs; label `dependencies`.
- Merge only after CI green; prefer one dependency group per release when possible.

## Liara schema drift

- Backend image runs `prisma migrate deploy` on start.
- Never point Liara at a truncated `schema.prisma`.
- If schema/export desyncs: use tagged release + sync workflow; emergency path is `emergency-restore-schema.yml` (manual only).
