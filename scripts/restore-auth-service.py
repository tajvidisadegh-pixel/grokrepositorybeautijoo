#!/usr/bin/env python3
"""Restore backend/src/auth/auth.service.ts from commit c3d0c362 and make password optional."""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "backend" / "src" / "auth" / "auth.service.ts"
COMMIT = "c3d0c362b126e16ff6682515be80021094a18f82"

content = subprocess.check_output(
    ["git", "show", f"{COMMIT}:backend/src/auth/auth.service.ts"],
    cwd=ROOT,
).decode("utf-8")

old = "    const passwordHash = await argon2.hash(dto.password);"
new = """    // Password is optional (issue #43) - OTP-only accounts have null passwordHash
    const passwordHash =
      dto.password && dto.password.length >= 8
        ? await argon2.hash(dto.password)
        : null;"""

if old not in content:
    raise SystemExit("expected passwordHash line not found in restored file")

TARGET.write_text(content.replace(old, new, 1), encoding="utf-8")
print(f"restored and patched {TARGET} ({TARGET.stat().st_size} bytes)")
