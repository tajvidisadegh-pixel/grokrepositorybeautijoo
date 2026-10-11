from pathlib import Path

# admin layout
p = Path('frontend/src/app/admin/layout.tsx')
t = p.read_text(encoding='utf-8')
if '/admin/catalog-template' not in t:
    t = t.replace(
        "{ href: '/admin/service-categories'",
        "{ href: '/admin/catalog-template', label: '\u06a9\u0627\u062a\u0627\u0644\u0648\u06af \u0642\u0627\u0644\u0628', anyOf: ['admin.catalog.manage'] },\n  { href: '/admin/service-categories'",
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('admin nav ok')
else:
    print('admin nav exists')

# zibagar layout
p = Path('frontend/src/app/zibagar/layout.tsx')
t = p.read_text(encoding='utf-8')
if "/zibagar/menu" not in t:
    t = t.replace(
        "{ href: '/zibagar/services', label: '",
        "{ href: '/zibagar/menu', label: '\u0645\u0646\u0648\u06cc \u062e\u062f\u0645\u0627\u062a (\u062c\u062f\u06cc\u062f)' },\n  { href: '/zibagar/services', label: '",
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('zibagar nav ok')
else:
    print('zibagar nav exists')
