# Security r4 — owner actions

Code fixes for critical/high admin issues are on main.

## Still requires repository owner

1. **Make the repository private** (GitHub Settings → Change visibility).
2. **Scan git history for secrets**:
   ```bash
   # e.g. gitleaks
   gitleaks detect --source . --log-opts="--all"
   ```
3. Rotate any secrets that ever appeared in commits.
4. Stop bot workflows that push directly to `main` without PR review.
5. Delete one-off scripts under `scripts/` that mutate production data
   (`force_payout_*`, `dedupe_payout_*`, empty `b64chunks` / `.tmp`).
6. Confirm Liara disk is mounted for `STORAGE_LOCAL_PATH` or set `STORAGE_PROVIDER=s3`.

## Applied in code (reference)

- Admin dashboard permission, role-grant restriction, hard-delete guards
- Booking/payout state machines, commission format, CMS publish keeps draft
- CMS image sniff, platform_config whitelist, storage path/MIME
- Impersonation short TTL, phone masking on admin lists, audit IP omitted
- Frontend Dockerfile non-root + HEALTHCHECK + npm ci required


## Items 18–36 (medium + infra) applied in code

- Campaign recipient phones masked
- setMediaStatus purges storage on rejected/deleted
- Local storage download path uses basePath + separator
- db-reset.sh requires ALLOW_DB_RESET=yes and blocks production
- Frontend Dockerfile uses symlinks for standalone path (less image bloat)
- Backend Dockerfile requires package-lock.json + HEALTHCHECK
- scripts/README danger notice; .gitignore for junk dirs

Still owner-only: make repo private, gitleaks history scan, stop direct-to-main bot pushes without review.
