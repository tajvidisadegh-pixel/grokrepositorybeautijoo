#!/usr/bin/env python3
from pathlib import Path
import sys

paths = [
    Path('backend/src/auth/auth.service.ts'),
]
changed = False
for p in paths:
    if not p.is_file():
        print('skip missing', p)
        continue
    t = p.read_text()
    old = "    const purposeBase = (dto.purpose || 'login').toString().trim();"
    new = "    let purposeBase = (dto.purpose || 'login').toString().trim();"
    if old in t:
        t = t.replace(old, new, 1)
        p.write_text(t)
        print('fixed', p)
        changed = True
    elif "let purposeBase = (dto.purpose || 'login')" in t:
        print('already', p)
    else:
        print('pattern missing', p)
        sys.exit(1)
if not changed:
    print('no file changed')
