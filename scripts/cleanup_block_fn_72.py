#!/usr/bin/env python3
import re
from pathlib import Path
p = Path('frontend/src/app/zibagar/bookings/page.tsx')
t = p.read_text()
t2, n = re.subn(r"\n  async function blockCustomerDisabled\([\s\S]*?\n  \}\n", "\n", t, count=1)
t2, n2 = re.subn(r"\n  async function blockCustomer\([\s\S]*?\n  \}\n", "\n", t2, count=1)
p.write_text(t2)
print('removed', n, n2, p.stat().st_size)
