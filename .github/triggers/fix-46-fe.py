from pathlib import Path
import re

# Fix 48: cast createdAt
p = Path('frontend/src/app/professionals/[slug]/page.tsx')
t = p.read_text()
t = t.replace('pro.createdAt', '(pro as { createdAt?: string }).createdAt')
# avoid double cast
while '(pro as { createdAt?: string }).createdAt' in t and '((pro as { createdAt?: string }) as { createdAt?: string }).createdAt' in t:
    t = t.replace('((pro as { createdAt?: string }) as { createdAt?: string }).createdAt', '(pro as { createdAt?: string }).createdAt')
# fix double if any from replace
t = t.replace('(pro as { createdAt?: string }).(pro as { createdAt?: string }).createdAt', '(pro as { createdAt?: string }).createdAt')
t = re.sub(r'\(pro as \{ createdAt\?: string \}\)\.\(pro as \{ createdAt\?: string \}\)\.createdAt', '(pro as { createdAt?: string }).createdAt', t)
p.write_text(t)
print('48 cast done')

# Fix 49 FE: remove broken block button block that references b outside map
p2 = Path('frontend/src/app/zibagar/bookings/page.tsx')
t2 = p2.read_text()
# Remove orphaned block button if present outside loop
pat = re.compile(
    r'\s*\{b\.customer\?\.id && \(\s*<button[^>]*>\s*مسدود کردن مشتری\s*</button>\s*\)\}\s*',
    re.DOTALL,
)
new_t2, n = pat.subn('\n', t2)
if n:
    t2 = new_t2
    print('removed orphan buttons', n)
else:
    # try simpler line-based removal around line 608 area
    lines = t2.splitlines(True)
    out = []
    skip = 0
    for i, line in enumerate(lines):
        if 'مسدود کردن مشتری' in line:
            # drop surrounding few lines of the button
            # remove previous lines that are part of button if still in out
            while out and ('b.customer' in out[-1] or 'blockCustomer' in out[-1] or 'text-red-600' in out[-1] or out[-1].strip() in ('{b.customer?.id && (', ')}', '</button>')):
                out.pop()
            skip = 0
            continue
        if 'blockCustomer(b.customer' in line:
            continue
        out.append(line)
    t2 = ''.join(out)
    print('line-based cleanup')

# Keep blockCustomer function - it's fine
# Re-add button INSIDE the map near report, more carefully
if 'مسدود کردن مشتری' not in t2 and 'setReportFor(reportFor === b.id' in t2:
    needle = 'setReportFor(reportFor === b.id ? null : b.id)'
    pos = t2.find(needle)
    if pos > 0:
        btn_end = t2.find('</button>', pos)
        btn_end = t2.find('\n', btn_end) + 1
        btn = (
            "                            {b.customer?.id ? (\n"
            "                              <button\n"
            "                                type=\"button\"\n"
            "                                className=\"text-xs text-red-600 hover:underline\"\n"
            "                                disabled={busy === `${b.customer.id}:block`}\n"
            "                                onClick={() => void blockCustomer(b.customer!.id)}\n"
            "                              >\n"
            "                                مسدود کردن مشتری\n"
            "                              </button>\n"
            "                            ) : null}\n"
        )
        t2 = t2[:btn_end] + btn + t2[btn_end:]
        print('reinserted button inside map')

p2.write_text(t2)
print('DONE FE fix')
