# Owner hygiene checklist (issue #82)

## Done in repo
- One-shot patch workflows retired (kept: ci, codeql, gitleaks, release, deploy sync, smoke).
- One-shot `scripts/fix-*.py` retired; only operational shell scripts remain.
- `db-reset.sh` blocked for production + requires `ALLOW_DB_RESET=yes`.
- RolesGuard: when both `@Roles` and `@RequirePermissions` are set, **both** are required.

## You must do in GitHub settings
1. **Branch protection on `main`**: require PR + status checks; block direct pushes (including bots).
2. **Repository visibility**: set Private if not intentional public.
3. **Secret scanning**: enable GitHub secret scanning + push protection; run history scan if was ever public.
4. Do not re-enable `workflow_dispatch` patchers that `git push` to `main`.
