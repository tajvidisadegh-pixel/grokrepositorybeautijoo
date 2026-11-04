#!/usr/bin/env python3
from pathlib import Path
p = Path('backend/src/admin/admin.service.ts')
t = p.read_text()
while '  PayoutStatus,\n  PayoutStatus,\n' in t:
    t = t.replace('  PayoutStatus,\n  PayoutStatus,\n', '  PayoutStatus,\n')
p.write_text(t)
print(t.count('PayoutStatus'))
