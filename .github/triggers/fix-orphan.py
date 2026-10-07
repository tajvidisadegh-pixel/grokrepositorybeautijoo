from pathlib import Path
p = Path('frontend/src/app/zibagar/bookings/page.tsx')
t = p.read_text()
# Find last proper closing of export default function
# Component ends with `}\n` after return's closing
marker = '    </div>\n  );\n}\n'
idx = t.rfind(marker)
if idx > 0:
    t = t[:idx + len(marker)]
    p.write_text(t)
    print('trimmed orphan after component, new len', len(t))
else:
    # try alternate
    idx = t.find('export default function')
    # find matching end: last line that is just }
    lines = t.splitlines(True)
    # find first line after export that is just `}` at column 0
    end = None
    for i, line in enumerate(lines):
        if i > 50 and line.strip() == '}':
            end = i
            # keep going to find last such before orphans
    if end:
        # check if there is content after
        rest = ''.join(lines[end+1:]).strip()
        if rest:
            p.write_text(''.join(lines[:end+1]))
            print('trimmed via lines, removed', len(rest), 'chars')
        else:
            print('no orphan')
    else:
        print('marker missing')
