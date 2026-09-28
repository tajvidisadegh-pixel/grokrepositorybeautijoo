#!/usr/bin/env python3
from pathlib import Path

p = Path('backend/src/professionals/professionals.service.ts')
s = p.read_text()
if 'is: { gender: g }' in s:
    print('already fixed')
    raise SystemExit(0)
old = """    if (params.gender) {
      const g = params.gender.trim().toLowerCase();
      if (['female', 'male', 'other'].includes(g)) {
        where.user = {
          ...(typeof where.user === 'object' && where.user !== null ? where.user : {}),
          profile: { gender: g as 'female' | 'male' | 'other' },
        };
      }
    }"""
new = """    if (params.gender) {
      const g = params.gender.trim().toLowerCase();
      if (g === 'female' || g === 'male' || g === 'other') {
        where.user = {
          profile: {
            is: { gender: g },
          },
        };
      }
    }"""
if old not in s:
    raise SystemExit('block not found')
p.write_text(s.replace(old, new, 1))
print('patched')
