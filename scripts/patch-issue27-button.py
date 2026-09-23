from pathlib import Path
p = Path('frontend/src/app/zibagar/page.tsx')
t = p.read_text()
t2 = t.replace("variant={needsSpecialty ? 'default' : 'secondary'}", "variant={needsSpecialty ? 'primary' : 'secondary'}")
t2 = t2.replace("variant={needsPrice || needsSpecialty ? 'default' : 'secondary'}", "variant={needsPrice || needsSpecialty ? 'primary' : 'secondary'}")
t2 = t2.replace("variant={needsPortfolio ? 'default' : 'secondary'}", "variant={needsPortfolio ? 'primary' : 'secondary'}")
if t2 == t:
    raise SystemExit('no replacements')
p.write_text(t2)
print('ok')
