#!/usr/bin/env python3
import base64
from pathlib import Path
b64 = Path("scripts/admin_service_fixed.b64").read_text().strip()
content = base64.b64decode(b64).decode()
p = Path("backend/src/admin/admin.service.ts")
if "user.roles_change" not in content or "groupBy" not in content:
    raise SystemExit("decoded content missing expected fixes")
p.write_text(content)
print("restored", len(content))
