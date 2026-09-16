#!/usr/bin/env python3
from pathlib import Path

cp = Path('frontend/src/app/zibagar/profile/complete/page.tsx')
ct = cp.read_text()
# remove useMemo if no longer used
if 'useMemo(' not in ct and 'useMemo' in ct:
    ct = ct.replace('useCallback, useEffect, useMemo, useRef, useState', 'useCallback, useEffect, useRef, useState')
    ct = ct.replace('useCallback, useMemo, useEffect, useRef, useState', 'useCallback, useEffect, useRef, useState')
    cp.write_text(ct)
    print('useMemo removed from complete')
else:
    print('useMemo still used or already clean', 'useMemo(' in ct)

# auth-storage
auth = Path('frontend/src/lib/auth-storage.ts')
if auth.exists():
    at = auth.read_text()
    if '_refreshToken' in at:
        # void unused param without changing API: omit name
        at2 = at.replace('_refreshToken', '_rt')
        # if still unused, eslint may still warn - use void pattern in body
        if 'function setTokens' in at2 or 'setTokens' in at2:
            # add void _rt if function body doesn't use it
            pass
        auth.write_text(at2)
        print('auth renamed')
    else:
        print('auth ok')
print('DONE')
