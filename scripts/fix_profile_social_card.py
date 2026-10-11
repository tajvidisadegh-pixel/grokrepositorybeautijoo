from pathlib import Path
p = Path('frontend/src/app/zibagar/profile/page.tsx')
t = p.read_text(encoding='utf-8')
start = t.find('<Card className="space-y-3 border-dashed border-border/70 bg-gray-light/20">')
if start < 0:
    raise SystemExit('card not found')
# find matching end of this card before {confirm
end_marker = '{confirm && ('
end = t.find(end_marker, start)
if end < 0:
    raise SystemExit('end not found')
# walk back to include the card closing
chunk = t[start:end]
# ensure we cut a full card
if '</Card>' not in chunk:
    raise SystemExit('no card close')
last = chunk.rfind('</Card>') + len('</Card>')
t = t[:start] + t[start + last:]
# clean extra blank lines
while '\n\n\n\n' in t:
    t = t.replace('\n\n\n\n', '\n\n')
p.write_text(t, encoding='utf-8')
print('removed social card')
