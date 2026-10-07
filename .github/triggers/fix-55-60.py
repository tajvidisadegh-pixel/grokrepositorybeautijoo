# -*- coding: utf-8 -*-
from pathlib import Path

p = Path('frontend/src/app/panel/bookings/page.tsx')
t = p.read_text(encoding='utf-8')

start_marker = 'onChange={(e) => setComment(e.target.value.slice(0, 500))}'
end_marker = '<div className="flex gap-2">'
start = t.find(start_marker)
if start < 0:
    raise SystemExit('start missing')
ts = t.rfind('<textarea', 0, start)
end = t.find(end_marker, start)
if ts < 0 or end < 0:
    raise SystemExit(f'bounds {ts} {end}')

replacement = '''<textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value.slice(0, 500))}
                        maxLength={500}
                        rows={2}
                        placeholder="نظر شما (اختیاری)"
                        className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                      />
                      <p className="text-left text-xs text-gray" dir="ltr">{`${comment.length}/500`}</p>
                      '''
t = t[:ts] + replacement + t[end:]
p.write_text(t, encoding='utf-8')
print('repaired textarea block')
# show region
i = t.find(start_marker)
print(t[i-40:i+350])
