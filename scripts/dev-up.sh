#!/usr/bin/env bash
# راه‌اندازی سریع محیط توسعه: db + migrate/seed + backend + frontend
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# --- env check ---
if [[ -x "$ROOT/scripts/check-env.sh" ]]; then
  "$ROOT/scripts/check-env.sh" || true
fi

# --- database ---
echo "→ Postgres..."
docker compose -f docker/docker-compose.yml up -d
sleep 2
until docker compose -f docker/docker-compose.yml exec -T postgres pg_isready -U beautijoo -d beautijoo >/dev/null 2>&1; do
  sleep 1
done

# --- backend deps + migrate ---
echo "→ Backend install + migrate + seed..."
cd "$ROOT/backend"
if command -v bun >/dev/null 2>&1; then
  bun install
  bunx prisma generate
  bunx prisma migrate dev
  bunx prisma db seed || true
else
  npm install
  npx prisma generate
  npx prisma migrate dev
  npx prisma db seed || true
fi

# --- frontend deps ---
echo "→ Frontend install..."
cd "$ROOT/frontend"
if command -v bun >/dev/null 2>&1; then
  bun install
else
  npm install
fi

# --- run both ---
echo ""
echo "Backend → http://localhost:3000"
echo "Frontend → http://localhost:3001 (یا پورت next)"
echo "برای توقف: Ctrl+C"
echo ""

cd "$ROOT"
if command -v bun >/dev/null 2>&1; then
  (cd backend && bun run start:dev) &
  BPID=$!
  (cd frontend && bun run dev) &
  FPID=$!
else
  (cd backend && npm run start:dev) &
  BPID=$!
  (cd frontend && npm run dev) &
  FPID=$!
fi

trap "kill $BPID $FPID 2>/dev/null; exit" INT TERM
wait
