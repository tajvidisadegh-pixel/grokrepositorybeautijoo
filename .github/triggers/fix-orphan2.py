from pathlib import Path
p = Path('frontend/src/app/zibagar/bookings/page.tsx')
lines = p.read_text().splitlines(True)
# Keep only up to and including the first line that is exactly `}` after we've seen `  );`
out = []
seen_return_close = False
for i, line in enumerate(lines):
    out.append(line)
    if line.strip() == ');' and '  );' in line:
        seen_return_close = True
    if seen_return_close and line.rstrip() == '}':
        break
p.write_text(''.join(out))
print('lines now', len(out))
print('tail:', repr(''.join(out[-3:])))
