#!/usr/bin/env python3
import re
from pathlib import Path

p = Path('frontend/src/app/zibagar/portfolio/page.tsx')
t = p.read_text()
t = t.replace(
    "  const [localPreview, setLocalPreview] = useState<string | null>(null);\n",
    "",
)
# remove localPreview UI block
t, n = re.subn(
    r"\n      \{localPreview && \([\s\S]*?\n      \)\}\n",
    "\n",
    t,
    count=1,
)
print('preview block', n)
p.write_text(t)
print('size', p.stat().st_size)
if 'localPreview' in t:
    raise SystemExit('localPreview still present')
