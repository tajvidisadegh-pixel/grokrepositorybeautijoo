#!/usr/bin/env python3
from pathlib import Path

# Fix pattern: className="..."{expr}  -> className="...">{expr}
# (missing > after attribute)

def fix(text: str) -> str:
    import re
    # className="..."{  without > before {
    return re.sub(
        r'(className="[^"]*")(\{)',
        r'\1>\2',
        text,
    )

for path in [
    'frontend/src/app/categories/[slug]/page.tsx',
    'frontend/src/app/locations/[city]/page.tsx',
]:
    p = Path(path)
    if not p.exists():
        print('missing', path)
        continue
    s = p.read_text()
    n = fix(s)
    if n != s:
        p.write_text(n)
        print('fixed', path)
    else:
        print('no change', path)
