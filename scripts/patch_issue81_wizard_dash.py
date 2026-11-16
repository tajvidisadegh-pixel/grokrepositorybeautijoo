#!/usr/bin/env python3
"""#81 — force wizard exit gate + layout draft gate."""
from pathlib import Path
import sys

comp = Path('frontend/src/app/zibagar/profile/complete/page.tsx')
if not comp.is_file():
    print('complete missing')
    sys.exit(1)
t = comp.read_text()
old = '<Link href="/zibagar"><Button variant="outline" size="sm">خروج</Button></Link>'
new = (
    '{(isPublished || pro?.status === \'pending_review\') ? ('
    '<Link href="/zibagar"><Button variant="outline" size="sm">ورود به داشبورد</Button></Link>'
    ') : ('
    '<span className="text-xs text-gray">برای ورود به داشبورد، مراحل را کامل و برای بررسی ارسال کنید</span>'
    ')}'
)
if old in t:
    t = t.replace(old, new, 1)
    comp.write_text(t)
    print('complete exit gated')
elif 'ورود به داشبورد' in t:
    print('complete already')
else:
    print('complete pattern missing')

lay = Path('frontend/src/app/zibagar/layout.tsx')
if lay.is_file():
    t = lay.read_text()
    old = "        const needsWizard = status === 'draft' && !complete;"
    new = (
        "        // #81 — incomplete draft cannot use dashboard\n"
        "        const needsWizard = (status === 'draft' || !status) && !complete;"
    )
    if old in t:
        lay.write_text(t.replace(old, new, 1))
        print('layout gate ok')
    else:
        print('layout skip')
else:
    print('layout missing')

print('done')
