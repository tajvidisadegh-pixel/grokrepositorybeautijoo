#!/usr/bin/env python3
"""Apply issue #10: auth settings methods + settings page + panel-api helpers."""
import base64, zlib, pathlib, subprocess, re, sys

ROOT = pathlib.Path(".")

# --- auth.service.ts ---
good = subprocess.check_output(
    ["git", "show", "58f24af:backend/src/auth/auth.service.ts"], text=True
)
# Ensure UserStatus import
if "UserStatus" not in good:
    good = re.sub(
        r"import \{([^}]+)\} from '@prisma/client';",
        lambda m: (
            m.group(0)
            if "UserStatus" in m.group(1)
            else f"import {{{m.group(1).strip()}, UserStatus}} from '@prisma/client';"
        ),
        good,
        count=1,
    )
methods = ROOT.joinpath("scripts/i10_auth_methods.ts").read_text()
if "changePassword" not in good:
    good = good.rstrip()
    if good.endswith("}"):
        good = good[:-1].rstrip() + "\n\n" + methods + "}\n"
    else:
        good = good + "\n" + methods + "\n"
out = ROOT / "backend/src/auth/auth.service.ts"
out.write_text(good)
assert "changePassword" in out.read_text()
assert "UserStatus" in out.read_text()
print("auth.service OK", out.stat().st_size)

# --- settings page ---
b64 = ROOT.joinpath("scripts/i10.settings.zlib.b64").read_text().strip()
data = zlib.decompress(base64.b64decode(b64))
sp = ROOT / "frontend/src/app/panel/settings/page.tsx"
sp.write_bytes(data)
assert "تغییر رمز".encode() in data
print("settings OK", len(data))

# --- panel-api helpers ---
pa = ROOT / "frontend/src/lib/panel-api.ts"
text = pa.read_text()
if "changePassword" not in text:
    # restore from good commit if PLACEHOLDER
    if "PLACEHOLDER" in text or len(text) < 500:
        text = subprocess.check_output(
            ["git", "show", "58f24af:frontend/src/lib/panel-api.ts"], text=True
        )
    helpers = ROOT.joinpath("scripts/i10_panel_helpers.ts").read_text()
    text = text.rstrip() + "\n" + helpers
    pa.write_text(text)
assert "changePassword" in pa.read_text()
print("panel-api OK", pa.stat().st_size)

print("ALL OK")
