#!/usr/bin/env bash
set -euo pipefail
mkdir -p frontend/src/app/zibagar/earnings
cat scripts/issue23/p0.b64 scripts/issue23/p1.b64 scripts/issue23/p2.b64 scripts/issue23/p3.b64 scripts/issue23/p4.b64 | tr -d '\n' | base64 -d > frontend/src/app/zibagar/earnings/page.tsx
wc -c frontend/src/app/zibagar/earnings/page.tsx
grep -q 'کل درآمد' frontend/src/app/zibagar/earnings/page.tsx
if grep -q 'ناخالص' frontend/src/app/zibagar/earnings/page.tsx; then echo ERROR_gross; exit 1; fi
if grep -q 'platformCommission' frontend/src/app/zibagar/earnings/page.tsx; then echo ERROR_commission; exit 1; fi
echo OK
