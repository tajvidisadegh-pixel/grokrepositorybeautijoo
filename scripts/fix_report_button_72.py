#!/usr/bin/env python3
from pathlib import Path

p = Path('frontend/src/app/zibagar/bookings/page.tsx')
t = p.read_text()

broken = '''                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReportFor(reportFor === b.id ? null : b.id);
                              setReportText('');
                              setReportMsg(null);
                            }}
                          ) : null}
                        </div>'''

fixed = '''                          <Button
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

if broken not in t:
    if 'گزارش به سوپرادمین' in t:
        print('already has report label')
    else:
        raise SystemExit('broken pattern not found')
else:
    t = t.replace(broken, fixed, 1)
    p.write_text(t)
    print('fixed report button', p.stat().st_size)
