#!/usr/bin/env python3
"""Retire one-shot patch workflows/scripts; keep operational tooling only."""
from pathlib import Path
import os
import re

KEEP_WORKFLOWS = {
    "ci.yml",
    "codeql.yml",
    "gitleaks.yml",
    "post-deploy-smoke.yml",
    "production-zips.yml",
    "create-release-tag.yml",
    "create-stable-tag.yml",
    "sync-backend-deploy-branch.yml",
    "generate-backend-lockfile.yml",
    "commit-backend-lockfile.yml",
    # keep this hygiene runner only until applied
    "run-hygiene-retire-oneshots.yml",
}

KEEP_SCRIPTS = {
    "README.md",
    ".keep",
    "check-env.sh",
    "db-reset.sh",
    "dev-up.sh",
    "hygiene-retire-oneshots.py",
}

# ---------------------------------------------------------------------------
# 1) Delete one-shot workflows (anything not in KEEP)
# ---------------------------------------------------------------------------
wf_dir = Path(".github/workflows")
deleted_wf = []
for p in sorted(wf_dir.glob("*.yml")):
    if p.name in KEEP_WORKFLOWS:
        continue
    # Also keep if it's a real CI-like name we might have missed
    if p.name in {"ci-green-fix.yml"}:
        # retire — was a patcher
        pass
    p.unlink()
    deleted_wf.append(p.name)
print(f"deleted workflows: {len(deleted_wf)}")

# ---------------------------------------------------------------------------
# 2) Delete one-shot scripts
# ---------------------------------------------------------------------------
scripts = Path("scripts")
deleted_sc = []
for p in sorted(scripts.iterdir()):
    if not p.is_file():
        continue
    if p.name in KEEP_SCRIPTS:
        continue
    p.unlink()
    deleted_sc.append(p.name)
print(f"deleted scripts: {len(deleted_sc)}")

# Update scripts README
readme = scripts / "README.md"
readme.write_text(
    """# scripts/

Operational scripts only. One-shot regex patchers were retired (issue #82 hygiene).

| Script | Purpose |
|--------|--------|
| `check-env.sh` | Validate required env vars |
| `db-reset.sh` | Local DB reset (blocked in production; needs `ALLOW_DB_RESET=yes`) |
| `dev-up.sh` | Local docker compose up |

Do **not** re-add `fix-*.py` / `apply-*.py` one-shot patchers that rewrite source with regex.
""",
    encoding="utf-8",
)
print("scripts README updated")

# ---------------------------------------------------------------------------
# 3) RolesGuard comment align with BOTH semantics
# ---------------------------------------------------------------------------
rg = Path("backend/src/common/guards/roles.guard.ts")
if rg.exists():
    t = rg.read_text(encoding="utf-8")
    old = " * - If both: pass when role OR permissions match (channel admins)."
    new = " * - If both: require BOTH role and permissions (stricter, #r4.M9)."
    if old in t:
        t = t.replace(old, new, 1)
        rg.write_text(t, encoding="utf-8")
        print("RolesGuard comment fixed")
    else:
        print("RolesGuard comment already ok or different")

# ---------------------------------------------------------------------------
# 4) Impersonation TTL — ensure short-lived token if missing
# ---------------------------------------------------------------------------
auth = Path("backend/src/auth/auth.service.ts")
if auth.exists():
    at = auth.read_text(encoding="utf-8")
    if "issueImpersonation" in at or "impersonat" in at.lower():
        # look for expiresIn near impersonation
        if re.search(r"impersonat[\s\S]{0,400}expiresIn", at, re.I):
            print("impersonation expiresIn present")
        else:
            # try inject expiresIn: '15m' in sign calls that mention impersonat
            # conservative: only log
            print("impersonation block found; manual TTL check recommended")
        # Prefer env IMPERSONATION_JWT_TTL default 15m
        if "IMPERSONATION_JWT_TTL" not in at and "signAsync" in at:
            # replace common pattern if we find impersonation sign
            m = re.search(
                r"(this\.jwtService\.signAsync\([\s\S]{0,200}?isImpersonating[\s\S]{0,200}?)(\))",
                at,
            )
            if m and "expiresIn" not in m.group(0):
                print("would inject expiresIn but structure complex — skip auto")
            else:
                print("signAsync impersonation already has options or not matched")
    else:
        print("no impersonation methods in auth.service")

# ---------------------------------------------------------------------------
# 5) Document owner checklist
# ---------------------------------------------------------------------------
docs = Path("docs")
docs.mkdir(exist_ok=True)
(docs / "HYGIENE_OWNER.md").write_text(
    """# Owner hygiene checklist (issue #82)

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
""",
    encoding="utf-8",
)
print("docs/HYGIENE_OWNER.md written")
print("DONE hygiene")
