from pathlib import Path
p = Path('frontend/src/app/professionals/[slug]/page.tsx')
t = p.read_text()
old = "{(pro.status === 'approved' || pro.verifiedAt) && ("
new = "{(pro.status === 'approved' || !pro.status) && ("
if old not in t:
    raise SystemExit('pattern missing')
p.write_text(t.replace(old, new, 1))
print('fixed')
