#!/usr/bin/env python3
from pathlib import Path
p = Path('backend/src/admin/admin.service.ts')
t = p.read_text()
if 'PayoutStatus' not in t:
    t = t.replace(
        'PaymentStatus,\n  UserStatus,',
        'PaymentStatus,\n  PayoutStatus,\n  UserStatus,',
        1,
    )
if 'PayoutStatus' not in t:
    t = t.replace('PaymentStatus,', 'PaymentStatus,\n  PayoutStatus,', 1)
# ensure where uses enum
if 'as PayoutStatus' not in t:
    t = t.replace(
        'const where: { status?: string } = {};\n    if (status) where.status = status;',
        "const where: { status?: PayoutStatus } = {};\n    if (status && ['pending','approved','paid','rejected','cancelled'].includes(status)) {\n      where.status = status as PayoutStatus;\n    }",
        1,
    )
p.write_text(t)
assert 'PayoutStatus' in t
print('ok')
