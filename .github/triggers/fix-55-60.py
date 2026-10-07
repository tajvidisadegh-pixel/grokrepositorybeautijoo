# -*- coding: utf-8 -*-
from pathlib import Path
p = Path('frontend/src/app/panel/bookings/page.tsx')
t = p.read_text(encoding='utf-8')
# Broken: {comment.length}/500  -> JSX parses / as start of regex-ish
old = '{comment.length}/500'
new = '{`${comment.length}/500`}'
if old in t:
    t = t.replace(old, new)
    p.write_text(t, encoding='utf-8')
    print('fixed counter', t.count(new))
else:
    print('pattern missing', '{`${comment.length}/500`}' in t)
