# Liara frontend (repo root). Build frontend in isolation so Next standalone
# includes a COMPLETE next install — never partially copy next (breaks ESM paths).

FROM node:22-bookworm-slim AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PUBLIC_API_TIMEOUT_MS=12000
ENV DOCKER_STANDALONE=1

ARG NEXT_PUBLIC_API_URL=https://api.beautijoo.ir/api/v1
ARG NEXT_PUBLIC_APP_URL=https://beautijoo.ir
ARG NEXT_PUBLIC_APP_NAME=Beautijoo
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

COPY frontend/package.json frontend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY frontend/ ./
RUN npm run build

# Expect flat standalone (DOCKER_STANDALONE=1)
RUN set -e; \
  if [ -f .next/standalone/server.js ]; then \
    echo "standalone OK at .next/standalone"; \
  elif [ -f .next/standalone/frontend/server.js ]; then \
    echo "nested standalone — flattening"; \
    cp -a .next/standalone/frontend/. .next/standalone/; \
    rm -rf .next/standalone/frontend; \
  else \
    echo "server.js missing"; find .next -name server.js; exit 1; \
  fi; \
  test -f .next/standalone/server.js; \
  test -d .next/standalone/node_modules/next; \
  test -e .next/standalone/node_modules/next/dist/server/web/exports/index.js || \
  test -e .next/standalone/node_modules/next/dist/server/web/exports/index.js.map || \
  ls .next/standalone/node_modules/next/dist/server/web/exports/ | head

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Liara may start: node /app/standalone/server.js — full tree mirror (not frontend/ nested)
RUN mkdir -p /app/standalone \
  && cp -a /app/server.js /app/standalone/server.js \
  && cp -a /app/node_modules /app/standalone/node_modules \
  && mkdir -p /app/standalone/.next \
  && cp -a /app/.next/. /app/standalone/.next/ \
  && cp -a /app/public /app/standalone/public \
  && test -f /app/standalone/server.js \
  && test -d /app/standalone/node_modules/next

EXPOSE 3000
CMD ["node", "server.js"]
