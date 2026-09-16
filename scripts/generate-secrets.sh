#!/usr/bin/env bash
# تولید JWT secrets امن (حداقل ۳۲ کاراکتر)
set -euo pipefail

echo "JWT_ACCESS_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo ""
echo "این دو مقدار را در backend/.env قرار دهید (باید متفاوت باشند)."
