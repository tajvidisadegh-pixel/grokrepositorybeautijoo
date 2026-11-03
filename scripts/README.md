# Operational scripts

Keep only production-safe helpers here.

- `dev-up.sh` — local stack
- `db-reset.sh` — reset local DB (dev only)
- `check-env.sh` — validate env
- `generate-secrets.sh` — generate secrets for deploy

Temporary one-shot patch scripts for migrations may appear and should be removed after CI is green.

## #80 pricing

Pro pricing API (`pricingMode`, `depositAmount`, `optionDeltas`) is applied on main via services.controller/service.
