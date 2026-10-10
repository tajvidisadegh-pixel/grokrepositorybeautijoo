from pathlib import Path
p = Path('frontend/src/app/error.tsx')
t = p.read_text(encoding='utf-8')
if "from 'next/link'" not in t:
    t = t.replace("'use client';\n\n", "'use client';\n\nimport Link from 'next/link';\n\n", 1)
t = t.replace(
    '<a href="/" className="rounded-xl border border-border bg-white px-4 py-2 text-sm">بازگشت به صفحه اصلی</a>',
    '<Link href="/" className="rounded-xl border border-border bg-white px-4 py-2 text-sm">بازگشت به صفحه اصلی</Link>',
)
p.write_text(t, encoding='utf-8')
print('ok')
