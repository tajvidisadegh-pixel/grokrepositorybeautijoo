# Beautijoo frontend — Next.js 15 standalone for Liara
# Build context MUST be the frontend/ directory (not repo root).

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PUBLIC_API_TIMEOUT_MS=12000

ARG NEXT_PUBLIC_API_URL=https://api.beautijoo.ir/api/v1
ARG NEXT_PUBLIC_APP_URL=https://beautijoo.ir
ARG NEXT_PUBLIC_APP_NAME=Beautijoo
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

COPY package.json package-lock.json* ./
# Full install for build (next must be present; do not omit deps needed to compile)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
RUN npm run build

# Fail the image build if standalone is incomplete (prevents runtime MODULE_NOT_FOUND)
RUN set -e; \
  if [ -f .next/standalone/server.js ]; then \
    ROOT=.next/standalone; \
  elif [ -f .next/standalone/frontend/server.js ]; then \
    ROOT=.next/standalone/frontend; \
  else \
    echo "ERROR: standalone server.js not found"; find .next -maxdepth 3 -type f -name 'server.js' || true; exit 1; \
  fi; \
  echo "STANDALONE_ROOT=$ROOT"; \
  test -d "$ROOT/node_modules/next" || test -d "$ROOT/node_modules/next/dist" || { \
    echo "ERROR: next missing inside standalone"; ls -la "$ROOT" "$ROOT/node_modules" 2>/dev/null | head -50; exit 1; \
  }

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Prefer flat layout: server.js at /app/server.js (not /app/standalone/...)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Next sometimes nests under package folder name when tracing root differs
RUN set -e; \
  if [ -f ./server.js ]; then \
    echo "server.js at /app"; \
  elif [ -f ./frontend/server.js ]; then \
    cp -a ./frontend/. ./ && rm -rf ./frontend; \
  elif [ -f ./standalone/server.js ]; then \
    cp -a ./standalone/. ./ && rm -rf ./standalone; \
  else \
    echo "ERROR: cannot locate server.js in runner"; find . -name server.js | head; exit 1; \
  fi; \
  test -f ./server.js

EXPOSE 3000
# Do NOT use node standalone/server.js — that path breaks module resolution for next
CMD ["node", "server.js"]
