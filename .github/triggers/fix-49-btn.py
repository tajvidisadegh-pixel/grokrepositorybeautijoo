from pathlib import Path

p = Path('frontend/src/app/zibagar/bookings/page.tsx')
t = p.read_text()

if 'مسدود کردن مشتری' in t:
    print('already has button')
else:
    # Find the report button label and insert after its closing </Button>
    label = 'گزارش به سوپرادمین'
    idx = t.find(label)
    if idx < 0:
        raise SystemExit('report label not found')
    close = t.find('</Button>', idx)
    if close < 0:
        raise SystemExit('close Button not found')
    close_end = close + len('</Button>')
    btn = '''
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
                          ) : null}'''
    t = t[:close_end] + btn + t[close_end:]
    p.write_text(t)
    print('inserted after report Button')

# Ensure clean tail
lines = p.read_text().splitlines(True)
out = []
seen = False
for line in lines:
    out.append(line)
    if line.rstrip() == '  );':
        seen = True
    if seen and line.rstrip() == '}':
        break
p.write_text(''.join(out))
print('final lines', len(out))
print('has button', 'مسدود کردن مشتری' in ''.join(out))
