# Operational scripts

Keep only production-safe helpers here.

- `dev-up.sh` — local stack
- `db-reset.sh` — reset local DB (dev only)
- `check-env.sh` — validate env
- `generate-secrets.sh` — generate secrets for deploy

One-shot patch scripts for migrations may appear temporarily and should be removed after CI is green.
