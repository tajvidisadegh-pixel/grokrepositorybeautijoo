from pathlib import Path

p = Path('frontend/src/app/zibagar/bookings/page.tsx')
t = p.read_text(encoding='utf-8')

CHECK = 'loading={busy === `${b.customer.id}:block`}'
if CHECK in t:
    print('already present')
else:
    # Unique to the report toggle button in the list UI
    needle = 'setReportFor(reportFor === b.id ? null : b.id);'
    idx = t.find(needle)
    if idx < 0:
        raise SystemExit('needle not found: setReportFor')
    close = t.find('</Button>', idx)
    if close < 0:
        raise SystemExit('Button close not found')
    close_end = close + len('</Button>')
    # Label as UTF-8 Persian (Python source string)
    label = 'مسدود کردن مشتری'
    btn = f'''
                          {{b.customer?.id ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              loading={{busy === `${{b.customer.id}}:block`}}
                              onClick={{() => void blockCustomer(b.customer!.id)}}
                            >
                              {label}
                            </Button>
                          ) : null}}'''
    # Fix accidental double-braces from f-string - we need single braces for JSX
    # Actually f-string doubled {{ to literal {. Template ${b.customer.id} needs careful handling.
    btn = '''
                          {b.customer?.id ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              loading={busy === `${b.customer.id}:block`}
                              onClick={() => void blockCustomer(b.customer!.id)}
                            >
                              ''' + label + '''
                            </Button>
                          ) : null}'''
    t = t[:close_end] + btn + t[close_end:]
    p.write_text(t, encoding='utf-8')
    print('wrote insert at', close_end, 'new size', len(t))

text = p.read_text(encoding='utf-8')
assert CHECK in text, 'insert verification failed'
print('OK verified')
