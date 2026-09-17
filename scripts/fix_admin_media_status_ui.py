#!/usr/bin/env python3
from pathlib import Path
p = Path('frontend/src/app/admin/professionals/[id]/page.tsx')
t = p.read_text()
old = '''                {m.status !== 'approved' && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => mediaStatus(m.id, 'approved')}>تأیید</Button>
                )}
                {m.status !== 'rejected' && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => mediaStatus(m.id, 'rejected')}>رد</Button>
                )}'''
new = '''                {m.status !== 'published' && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => mediaStatus(m.id, 'published')}>انتشار رسانه</Button>
                )}
                {m.status !== 'draft' && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => mediaStatus(m.id, 'draft')}>پیش‌نویس</Button>
                )}'''
if old in t:
    p.write_text(t.replace(old, new, 1))
    print('media buttons fixed')
else:
    print('pattern miss')
    # softer replace
    t2 = t.replace("mediaStatus(m.id, 'approved')", "mediaStatus(m.id, 'published')")
    t2 = t2.replace("mediaStatus(m.id, 'rejected')", "mediaStatus(m.id, 'draft')")
    t2 = t2.replace("m.status !== 'approved'", "m.status !== 'published'")
    t2 = t2.replace("m.status !== 'rejected'", "m.status !== 'draft'")
    if t2 != t:
        p.write_text(t2)
        print('soft fixed')
    else:
        raise SystemExit('no change')
