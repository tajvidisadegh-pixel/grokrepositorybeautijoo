from pathlib import Path

# Fix search page: buildHref -> pageHref
p = Path('frontend/src/app/search/page.tsx')
t = p.read_text()
if 'buildHref(1)' in t:
    t = t.replace('buildHref(1)', 'pageHref(1)')
    p.write_text(t)
    print('search pageHref OK')
else:
    print('search skip')

# Fix hours: import formatDate, formatTime24
p2 = Path('frontend/src/app/zibagar/hours/page.tsx')
t2 = p2.read_text()
if 'formatDate' in t2 and "from '@/lib/utils'" not in t2:
    # add import after friendlyApiError import
    if "from '@/lib/api-errors'" in t2:
        t2 = t2.replace(
            "from '@/lib/api-errors';",
            "from '@/lib/api-errors';\nimport { formatDate, formatTime24 } from '@/lib/utils';",
            1,
        )
        p2.write_text(t2)
        print('hours import OK')
    else:
        print('hours import marker missing')
elif "formatDate, formatTime24" in t2:
    print('hours import already')
else:
    print('hours skip')
print('DONE')
