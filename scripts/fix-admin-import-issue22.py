#!/usr/bin/env python3
from pathlib import Path
p = Path('backend/src/admin/admin.service.ts')
t = p.read_text()
# Normalize nest imports
import re
m = re.search(r"import \{([^}]+)\} from '@nestjs/common';", t)
if m:
    names = [x.strip() for x in m.group(1).replace('\n', ' ').split(',') if x.strip()]
    # dedupe preserve order
    seen = set()
    uniq = []
    for n in names:
        if n not in seen:
            seen.add(n)
            uniq.append(n)
    for need in ('Injectable', 'Inject', 'NotFoundException', 'ForbiddenException', 'BadRequestException', 'Logger'):
        if need not in seen:
            uniq.append(need)
            seen.add(need)
    new_import = "import {\n  " + ",\n  ".join(uniq) + ",\n} from '@nestjs/common';"
    t = t[:m.start()] + new_import + t[m.end():]
    p.write_text(t)
    print('fixed imports', uniq)
else:
    raise SystemExit('import block not found')
