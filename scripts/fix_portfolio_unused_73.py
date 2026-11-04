#!/usr/bin/env python3
import re
from pathlib import Path

p = Path('frontend/src/app/zibagar/portfolio/page.tsx')
t = p.read_text()
# Remove unused single-file onUpload (kept onUploadMany)
t2, n = re.subn(
    r"\n  async function onUpload\(file: File\) \{[\s\S]*?\n  \}\n\n  async function onDelete",
    "\n\n  async function onDelete",
    t,
    count=1,
)
if n != 1:
    raise SystemExit(f'onUpload remove count={n}')
p.write_text(t2)
print('removed onUpload', p.stat().st_size)
