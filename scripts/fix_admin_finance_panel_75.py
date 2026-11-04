#!/usr/bin/env python3
from pathlib import Path

p = Path('frontend/src/app/admin/finance/page.tsx')
t = p.read_text()

if "from '@/lib/api'" not in t and 'apiClient' in t:
    t = t.replace(
        "import { friendlyApiError } from '@/lib/api-errors';\n",
        "import { friendlyApiError } from '@/lib/api-errors';\n"
        "import { apiClient } from '@/lib/api';\n",
        1,
    )
    print('apiClient import added')

if '<PayoutRequestsPanel' not in t:
    # inject before closing of main return — before last `    </div>\n  );` of AdminFinancePage
    needle = '''      {(detail || detailLoading) && (
        <Card className="space-y-2">
'''
    inject = '''      <Card className="mt-6 space-y-3 p-4">
        <h2 className="font-bold">درخواست‌های تسویه زیباگران</h2>
        <p className="text-xs text-gray">پس از واریز دستی، وضعیت را «تسویه‌شده» کنید.</p>
        <PayoutRequestsPanel />
      </Card>

      {(detail || detailLoading) && (
        <Card className="space-y-2">
'''
    if needle not in t:
        # fallback: before final `  );\n}` of default function
        idx = t.find('function PayoutRequestsPanel')
        if idx < 0:
            raise SystemExit('no panel fn')
        # insert before the closing of AdminFinancePage — search backwards from panel
        head = t[:idx]
        # find last `  );\n}\n\n` before panel
        close = head.rfind('  );\n}\n')
        if close < 0:
            raise SystemExit('cannot find page close')
        block = '''
      <Card className="mt-6 space-y-3 p-4">
        <h2 className="font-bold">درخواست‌های تسویه زیباگران</h2>
        <p className="text-xs text-gray">پس از واریز دستی، وضعیت را «تسویه‌شده» کنید.</p>
        <PayoutRequestsPanel />
      </Card>
'''
        # insert before the `    </div>` that closes return
        last_div = head.rfind('    </div>')
        t = head[:last_div] + block + head[last_div:] + t[idx:]
        print('injected panel via fallback')
    else:
        t = t.replace(needle, inject, 1)
        print('injected panel before detail card')

p.write_text(t)
print('size', p.stat().st_size)
assert 'apiClient' in t
assert '<PayoutRequestsPanel' in t
