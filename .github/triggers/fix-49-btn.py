from pathlib import Path

p = Path('frontend/src/app/zibagar/bookings/page.tsx')
t = p.read_text()

if 'مسدود کردن مشتری' in t:
    print('button already present')
else:
    needle = '''                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReportFor(reportFor === b.id ? null : b.id);
                              setReportText('');
                              setReportMsg(null);
                            }}
                          >
                            گزارش به سوپرادمین
                          </Button>
                        </div>'''
    insert = '''                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReportFor(reportFor === b.id ? null : b.id);
                              setReportText('');
                              setReportMsg(null);
                            }}
                          >
                            گزارش به سوپرادمین
                          </Button>
                          {b.customer?.id ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              loading={busy === `${b.customer.id}:block`}
                              onClick={() => void blockCustomer(b.customer!.id)}
                            >
                              مسدود کردن مشتری
                            </Button>
                          ) : null}
                        </div>'''
    if needle in t:
        t = t.replace(needle, insert, 1)
        p.write_text(t)
        print('button inserted OK')
    else:
        print('NEEDLE MISSING')
        # debug: show nearby report button
        idx = t.find('گزارش به سوپرادمین')
        print('report idx', idx)
        if idx > 0:
            print(repr(t[idx-200:idx+120]))

# Ensure file ends cleanly at component close
lines = t.splitlines(True)
out = []
seen = False
for line in lines:
    out.append(line)
    if line.rstrip() == '  );':
        seen = True
    if seen and line.rstrip() == '}':
        break
new_t = ''.join(out)
if new_t != t:
    p.write_text(new_t)
    print('trimmed trailing junk')
else:
    # re-read after possible write
    t2 = p.read_text()
    lines2 = t2.splitlines(True)
    out2 = []
    seen2 = False
    for line in lines2:
        out2.append(line)
        if line.rstrip() == '  );':
            seen2 = True
        if seen2 and line.rstrip() == '}':
            break
    if ''.join(out2) != t2:
        p.write_text(''.join(out2))
        print('trimmed after insert')
    else:
        print('tail clean, lines', len(out2))
