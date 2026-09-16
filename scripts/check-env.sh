#!/usr/bin/env bash
# بررسی وجود متغیرهای ضروری قبل از اجرای backend/frontend
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_ENV="$ROOT/backend/.env"
FRONTEND_ENV="$ROOT/frontend/.env.local"

missing=0

check_file() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    echo "❌ فایل وجود ندارد: $f"
    echo "   → از .env.example کپی کنید."
    missing=1
    return
  fi
  echo "✅ $f"
}

check_var() {
  local file="$1" var="$2"
  if [[ ! -f "$file" ]]; then return; fi
  if ! grep -qE "^${var}=.+" "$file" 2>/dev/null; then
    echo "⚠️  $var در $file خالی یا تعریف نشده"
    missing=1
  fi
}

echo "=== Backend env ==="
check_file "$BACKEND_ENV"
check_var "$BACKEND_ENV" "DATABASE_URL"
check_var "$BACKEND_ENV" "JWT_ACCESS_SECRET"
check_var "$BACKEND_ENV" "JWT_REFRESH_SECRET"

echo ""
echo "=== Frontend env ==="
check_file "$FRONTEND_ENV"
check_var "$FRONTEND_ENV" "NEXT_PUBLIC_API_URL"

if [[ $missing -eq 1 ]]; then
  echo ""
  echo "برخی متغیرها ناقص‌اند. قبل از اجرا آن‌ها را پر کنید."
  exit 1
fi

echo ""
echo "همه چیز آماده است."
