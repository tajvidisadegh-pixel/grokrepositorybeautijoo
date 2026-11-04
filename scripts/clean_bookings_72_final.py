#!/usr/bin/env python3
import re
from pathlib import Path

p = Path('frontend/src/app/zibagar/bookings/page.tsx')
t = p.read_text()
# remove any block helper
for name in ('blockCustomerDisabled', 'blockCustomer'):
    t, n = re.subn(
        rf"\n  async function {name}\([\s\S]*?\n  \}\n",
        "\n",
        t,
        count=1,
    )
    print(name, n)
# remove any remaining block button text lines
if 'مسدود کردن مشتری' in t:
    lines = t.splitlines(keepends=True)
    out = []
    i = 0
    while i < len(lines):
        if 'مسدود کردن مشتری' in lines[i] or (
            'blockCustomer' in lines[i] and 'onClick' in lines[i]
        ):
            j = i
            while j > 0 and '<Button' not in lines[j]:
                j -= 1
            k = i
            while k < len(lines) and '</Button>' not in lines[k]:
                k += 1
            i = k + 1
            continue
        out.append(lines[i])
        i += 1
    t = ''.join(out)

p.write_text(t)
print('size', p.stat().st_size)
print('block left', 'blockCustomer' in t, 'مسدود کردن مشتری' in t)
