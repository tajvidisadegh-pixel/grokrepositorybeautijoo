#!/usr/bin/env python3
import base64, re
from pathlib import Path
p = Path('backend/src/admin/admin.service.ts')
st = p.read_text()
if 'NotificationType' not in st:
    st = st.replace(
        '  MediaStatus,\n  Prisma,',
        '  MediaStatus,\n  NotificationType,\n  Prisma,',
    )
b64 = (
    Path('scripts/pro_approve_methods.b64.part1').read_text().strip()
    + Path('scripts/pro_approve_methods.b64.part2').read_text().strip()
)
block = base64.b64decode(b64).decode()
pat = re.compile(
    r'  async getProfessionalDetail\(id: string\) \{.*?\n  \}\n\n  async setProfessionalFeatured',
    re.S,
)
if not pat.search(st):
    raise SystemExit('pattern not found')
st = pat.sub(block, st, count=1)
if 'NotificationType.system' not in st:
    raise SystemExit('patch incomplete')
p.write_text(st)
print('patched OK', len(st))
