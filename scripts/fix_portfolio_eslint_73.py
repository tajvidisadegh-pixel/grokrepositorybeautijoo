#!/usr/bin/env python3
from pathlib import Path

p = Path('frontend/src/app/zibagar/portfolio/page.tsx')
t = p.read_text()
t = t.replace(
    '    let remaining = Math.max(0, MAX_PORTFOLIO - items.length);',
    '    const remaining = Math.max(0, MAX_PORTFOLIO - items.length);',
    1,
)
old = '''    for (let i = 0; i < queue.length; i++) {
      const file = queue[i]!;
      setUploadProgress(0);
'''
new = '''    for (let i = 0; i < queue.length; i++) {
      const file = queue[i];
      if (!file) continue;
      setUploadProgress(0);
'''
if old not in t:
    raise SystemExit('loop pattern not found')
t = t.replace(old, new, 1)
p.write_text(t)
print('ok', p.stat().st_size)
