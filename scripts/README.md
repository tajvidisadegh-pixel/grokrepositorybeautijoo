# scripts/

Operational scripts only. One-shot regex patchers were retired (issue #82 hygiene).

| Script | Purpose |
|--------|--------|
| `check-env.sh` | Validate required env vars |
| `db-reset.sh` | Local DB reset (blocked in production; needs `ALLOW_DB_RESET=yes`) |
| `dev-up.sh` | Local docker compose up |

Do **not** re-add `fix-*.py` / `apply-*.py` one-shot patchers that rewrite source with regex.
