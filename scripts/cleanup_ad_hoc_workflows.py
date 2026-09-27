#!/usr/bin/env python3
"""Remove one-shot apply/fix/restore GitHub workflows.

Keeps only stable pipelines. Does not touch application source code.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WF = ROOT / ".github" / "workflows"

# Stable pipelines only — no emergency/patch helpers
KEEP = {
    "ci.yml",
    "codeql.yml",
    "production-zips.yml",
    "create-release-tag.yml",
    "sync-backend-deploy-branch.yml",
    "post-deploy-smoke.yml",
}

AD_HOC_RE = re.compile(
    r"^(apply-|fix-|restore-|patch-|install-|remove-|reapply-|run-|add-|admin-|"
    r"r184-|sed-|emergency-|decode-|diag-|social-links)",
    re.I,
)

# Explicit leftovers that do not match prefix patterns
EXTRA_AD_HOC = {
    "sed-18-4.yml",
    "r184-jalali_ts.yml",
    "cleanup-ad-hoc-workflows.yml",  # self — remove after last successful run via commit
}


def is_ad_hoc(name: str) -> bool:
    if name in KEEP:
        return False
    if name in EXTRA_AD_HOC:
        return True
    if AD_HOC_RE.match(name):
        return True
    return False


def main() -> int:
    if not WF.is_dir():
        print("no workflows dir", file=sys.stderr)
        return 1
    removed: list[str] = []
    kept: list[str] = []
    for path in sorted(WF.glob("*.yml")) + sorted(WF.glob("*.yaml")):
        if is_ad_hoc(path.name):
            path.unlink()
            removed.append(path.name)
        else:
            kept.append(path.name)
    print(f"removed {len(removed)} ad-hoc workflows")
    for n in removed:
        print(f"  - {n}")
    print(f"kept {len(kept)}")
    for n in kept:
        print(f"  + {n}")
    gh = ROOT / ".github"
    for p in gh.glob("ci-trigger-*.txt"):
        p.unlink()
        print(f"  - {p.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
