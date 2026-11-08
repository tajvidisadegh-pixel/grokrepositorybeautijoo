# Security hygiene (#82.9 / #82.infra21)

Owner checklist (cannot be fully automated from CI):

1. **Make the repository private** on GitHub (Settings → Danger Zone → Change visibility).
2. **Scan secrets in git history** with gitleaks or trufflehog.
3. **Rotate** any credentials that ever appeared in commits.
4. Confirm `.env` / `*.pem` are in `.gitignore`.
5. Prefer `STORAGE_PROVIDER=s3` in production.
6. Set `RUN_SEED_CATALOG_ON_BOOT=true` only when intentionally reseeding catalog.
