#!/usr/bin/env python3
"""#81 — force wizard, clearer exit, lighter dashboard."""
from pathlib import Path
import re
import sys

# --- 1) complete page: exit only after publish/pending/approved ---
comp = Path('frontend/src/app/zibagar/profile/complete/page.tsx')
if comp.is_file():
    t = comp.read_text()
    old = '<Link href="/zibagar"><Button variant="outline" size="sm">خروج</Button></Link>'
    new = '''{(isPublished || pro?.status === 'pending_review' || !!msg?.includes('بررسی')) ? (
            <Link href="/zibagar"><Button variant="outline" size="sm">ورود به داشبورد</Button></Link>
          ) : (
            <span className="text-xs text-gray">برای ورود به داشبورد، مراحل را کامل و ارسال کنید</span>
          )}'''
    if old in t:
        t = t.replace(old, new, 1)
        # ensure success CTA on last step after msg
        if 'ورود به داشبورد' not in t[t.find('step === 5'): t.find('step === 5') + 900] if 'step === 5' in t else True:
            pass
        comp.write_text(t)
        print('complete exit gated')
    elif 'ورود به داشبورد' in t:
        print('complete already')
    else:
        print('complete exit pattern missing')
else:
    print('complete missing')

# --- 2) layout: stronger draft gate (keep allowlist) ---
lay = Path('frontend/src/app/zibagar/layout.tsx')
if lay.is_file():
    t = lay.read_text()
    old = "        const needsWizard = status === 'draft' && !complete;"
    new = "        // #81 — draft incomplete must finish wizard before dashboard\n        const needsWizard = (status === 'draft' || !status) && !complete;"
    if old in t:
        t = t.replace(old, new, 1)
        lay.write_text(t)
        print('layout gate tightened')
    else:
        print('layout gate skip')
else:
    print('layout missing')

# --- 3) dashboard: hide quick-start tips when profile approved/complete ---
dash = Path('frontend/src/app/zibagar/page.tsx')
if dash.is_file():
    t = dash.read_text()
    if 'شروع سریع (۳۰ ثانیه)' in t and 'showQuickStart' not in t:
        # wrap the quick start card - find a simple marker
        # Inject condition before quick start heading block
        t2 = t.replace(
            '<h2 className="font-bold">شروع سریع (۳۰ ثانیه)</h2>',
            '{(pro?.status === \'draft\' || !pro?.completion?.complete) && (\n        <>
        <h2 className="font-bold">شروع سریع (۳۰ ثانیه)</h2>',
            1,
        )
        # This may break JSX - use safer approach: only change title section visibility via comment marker
        if t2 != t and t2.count('<>') == t.count('<>') + 1:
            # find end of quick start card - too fragile; revert to simpler
            t = t
            print('dash complex skip')
        else:
            # Simpler: rename section when not draft
            t = t.replace(
                '<h2 className="font-bold">شروع سریع (۳۰ ثانیه)</h2>',
                '{pro?.status === \'draft\' ? <h2 className="font-bold">شروع سریع (۳۰ ثانیه)</h2> : null}',
                1,
            )
            dash.write_text(t)
            print('dash quickstart conditional title')
    else:
        print('dash skip')
else:
    print('dash missing')

print('done')
