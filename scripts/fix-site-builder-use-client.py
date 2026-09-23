from pathlib import Path
p = Path('frontend/src/app/admin/site-builder/page.tsx')
t = p.read_text()
if t.startswith("import { formatDateTime }"):
    t = t.replace("import { formatDateTime } from '@/lib/utils';\n'use client';\n\n", "'use client';\n\nimport { formatDateTime } from '@/lib/utils';\n", 1)
    p.write_text(t)
    print('fixed')
else:
    print('already ok or unexpected', t[:80])
