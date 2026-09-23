#!/usr/bin/env python3
"""Issue #29: force Jalali (fa-IR-u-ca-persian) on remaining Gregorian displays."""
from pathlib import Path

ROOT = Path('.')

# --- zibagar bookings ---
p = ROOT / 'frontend/src/app/zibagar/bookings/page.tsx'
t = p.read_text()
t = t.replace(
    "return new Date(iso).toLocaleDateString('fa-IR', {\n      timeZone: TEHRAN_TZ,\n      weekday: 'long',\n      year: 'numeric',\n      month: 'long',\n      day: 'numeric',\n    });",
    "return new Date(iso).toLocaleDateString('fa-IR-u-ca-persian', {\n      timeZone: TEHRAN_TZ,\n      weekday: 'long',\n      year: 'numeric',\n      month: 'long',\n      day: 'numeric',\n    });",
)
t = t.replace(
    "label: d.toLocaleDateString('fa-IR', {\n          timeZone: TEHRAN_TZ,\n          weekday: 'short',\n          day: 'numeric',\n          month: 'short',\n        }),",
    "label: d.toLocaleDateString('fa-IR-u-ca-persian', {\n          timeZone: TEHRAN_TZ,\n          weekday: 'short',\n          day: 'numeric',\n          month: 'short',\n        }),",
)
p.write_text(t)
print('zibagar bookings ok')

# --- panel settings ---
p = ROOT / 'frontend/src/app/panel/settings/page.tsx'
t = p.read_text()
if "from '@/lib/utils'" not in t:
    t = t.replace(
        "} from '@/lib/panel-api';\n",
        "} from '@/lib/panel-api';\nimport { formatDateTime } from '@/lib/utils';\n",
    )
t = t.replace(
    """  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleString('fa-IR');
    } catch {
      return iso;
    }
  }

""",
    '',
)
t = t.replace('{formatDate(s.createdAt)}', '{formatDateTime(s.createdAt)}')
t = t.replace('{formatDate(s.expiresAt)}', '{formatDateTime(s.expiresAt)}')
p.write_text(t)
print('panel settings ok')

# --- admin audit ---
p = ROOT / 'frontend/src/app/admin/audit/page.tsx'
t = p.read_text()
if "from '@/lib/utils'" not in t and "formatDate" not in t:
    # add import after first import block
    lines = t.split('\n')
    for i, line in enumerate(lines):
        if line.startswith('import ') and i > 0 and not lines[i + 1].startswith('import') if i + 1 < len(lines) else True:
            pass
    if "formatDateTime" not in t:
        t = t.replace(
            "'use client';\n",
            "'use client';\n\nimport { formatDateTime } from '@/lib/utils';\n",
            1,
        )
elif "formatDateTime" not in t and "from '@/lib/utils'" in t:
    t = t.replace("from '@/lib/utils'", "from '@/lib/utils'")  # noop placeholder
    if 'formatDateTime' not in t:
        t = t.replace(
            "from '@/lib/utils'",
            "from '@/lib/utils'",
        )
if "formatDateTime" not in t:
    # try inject into existing utils import
    import re
    m = re.search(r"import \{([^}]+)\} from '@/lib/utils'", t)
    if m:
        t = t.replace(m.group(0), f"import {{{m.group(1).strip()}, formatDateTime}} from '@/lib/utils'")
    else:
        t = "import { formatDateTime } from '@/lib/utils';\n" + t
t = t.replace(
    "{new Date(log.createdAt).toLocaleString('fa-IR')}",
    "{formatDateTime(log.createdAt)}",
)
p.write_text(t)
print('admin audit ok')

# --- admin site-builder ---
p = ROOT / 'frontend/src/app/admin/site-builder/page.tsx'
t = p.read_text()
if 'formatDateTime' not in t:
    import re
    m = re.search(r"import \{([^}]+)\} from '@/lib/utils'", t)
    if m:
        if 'formatDateTime' not in m.group(1):
            t = t.replace(m.group(0), f"import {{{m.group(1).strip()}, formatDateTime}} from '@/lib/utils'")
    else:
        t = "import { formatDateTime } from '@/lib/utils';\n" + t
t = t.replace(
    "{new Date(publishedAt).toLocaleString('fa-IR')}",
    "{formatDateTime(publishedAt)}",
)
p.write_text(t)
print('site-builder ok')

# --- booking wizard: hide Gregorian ISO next to Jalali ---
p = ROOT / 'frontend/src/components/booking/booking-wizard.tsx'
t = p.read_text()
t = t.replace(
    '{isoToJalaliLabel(date)} <span className="text-xs text-gray" dir="ltr">({date})</span>',
    '{isoToJalaliLabel(date)}',
)
p.write_text(t)
print('booking wizard ok')

# --- footer year Jalali ---
p = ROOT / 'frontend/src/components/layout/footer.tsx'
if p.exists():
    t = p.read_text()
    if 'getFullYear()' in t and 'u-ca-persian' not in t:
        t = t.replace(
            '{new Date().getFullYear()}',
            "{new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(new Date())}",
        )
        p.write_text(t)
        print('footer ok')

print('DONE issue 29')
