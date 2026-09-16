#!/usr/bin/env bash
# ریست کامل دیتابیس توسعه: حذف volume → بالا آوردن → migrate → seed
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "⚠️  تمام داده‌های دیتابیس محلی حذف می‌شود."
read -r -p "ادامه؟ [y/N] " ans
if [[ "${ans:-}" != "y" && "${ans:-}" != "Y" ]]; then
  echo "لغو شد."
  exit 0
fi

echo "→ توقف و حذف volume..."
docker compose -f docker/docker-compose.yml down -v

echo "→ بالا آوردن Postgres..."
docker compose -f docker/docker-compose.yml up -d

echo "→ منتظر آماده‌شدن دیتابیس..."
sleep 3
until docker compose -f docker/docker-compose.yml exec -T postgres pg_isready -U beautijoo -d beautijoo >/dev/null 2>&1; do
  sleep 1
done

echo "→ migrate + seed..."
cd backend
if command -v bun >/dev/null 2>&1; then
  bunx prisma migrate dev --name reset
  bunx prisma db seed
else
  npx prisma migrate dev --name reset
  npx prisma db seed
fi

echo "✅ دیتابیس ریست و seed شد."
