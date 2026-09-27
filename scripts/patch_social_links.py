#!/usr/bin/env python3
"""Issue #36 finishers — idempotent."""
from pathlib import Path

def fix_eslint_any():
    p = Path("frontend/src/app/zibagar/profile/page.tsx")
    t = p.read_text()
    old = "value={(socialForm as any)[key] || ''}"
    new = "value={socialForm[key] || ''}"
    if old in t:
        t = t.replace(old, new)
        p.write_text(t)
        print("eslint any: fixed")
    else:
        print("eslint any: already clean")

if __name__ == "__main__":
    fix_eslint_any()
