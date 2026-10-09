from pathlib import Path
p = Path('frontend/src/app/zibagar/hours/page.tsx')
t = p.read_text(encoding='utf-8')
t2 = t.replace('let cur = new Date(start);', 'const cur = new Date(start);', 1)
p.write_text(t2, encoding='utf-8')
print('ok', t2 != t)
