from pathlib import Path
p = Path('frontend/src/app/professionals/[slug]/page.tsx')
t = p.read_text()
old = 'new Date((pro as { createdAt?: string }).createdAt)'
new = 'new Date((pro as { createdAt?: string }).createdAt!)'
if old in t:
    t = t.replace(old, new)
    p.write_text(t)
    print('fixed')
else:
    print('missing', old in t)
