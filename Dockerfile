# Beautijoo FRONTEND image (repo-root Dockerfile used by Liara when root is connected)
# Builds frontend in isolation (no workspace hoist) so Next standalone contains `next`.
#
# Liara runtime error we fix:
#   Error: Cannot find module 'next'
#   Require stack: - /app/standalone/server.js

FROM node:22-bookworm-slim AS builder
WORKDIR /app/frontend

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PUBLIC_API_TIMEOUT_MS=12000

ARG NEXT_PUBLIC_API_URL=https://api.beautijoo.ir/api/v1
ARG NEXT_PUBLIC_APP_URL=https://beautijoo.ir
ARG NEXT_PUBLIC_APP_NAME=Beautijoo
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

# Install only frontend deps (avoid monorepo workspace hoisting next to repo root)
COPY frontend/package.json frontend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY frontend/ ./

# Ensure tracing root is this package (server.js + node_modules/next side by side)
RUN npm run build

# Locate standalone server and verify next is traced
RUN set -e; \
  if [ -f .next/standalone/server.js ]; then S=.next/standalone; \
  elif [ -f .next/standalone/frontend/server.js ]; then S=.next/standalone/frontend; \
  else echo "standalone server.js missing"; find .next -name server.js | head; exit 1; fi; \
  echo "STANDALONE=$S"; \
  if [ ! -d "$S/node_modules/next" ]; then \
    echo "next not in standalone; copying from build node_modules"; \
    mkdir -p "$S/node_modules"; \
    cp -a node_modules/next "$S/node_modules/"; \
    # next peer deps often needed
    for p in react react-dom styled-jsx; do \
      [ -d "node_modules/$p" ] && cp -a "node_modules/$p" "$S/node_modules/" || true; \
    done; \
  fi; \
  test -d "$S/node_modules/next"; \
  # stage a clean tree for runner
  mkdir -p /out; \
  cp -a "$S"/. /out/; \
  mkdir -p /out/.next; \
  cp -a .next/static /out/.next/static; \
  cp -a public /out/public; \
  test -f /out/server.js

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Flat layout at /app (preferred)
COPY --from=builder /out/ ./

# Also mirror under /app/standalone so Liara start commands that use
#   node standalone/server.js
# still resolve `next` next to that server.js
RUN mkdir -p /app/standalone \
  && cp -a /app/server.js /app/standalone/ \
  && cp -a /app/node_modules /app/standalone/ \
  && mkdir -p /app/standalone/.next \
  && cp -a /app/.next/. /app/standalone/.next/ \
  && cp -a /app/public /app/standalone/public \
  && test -f /app/standalone/server.js \
  && test -d /app/standalone/node_modules/next

EXPOSE 3000

# Prefer flat start; both paths work after the mirror above
CMD ["node", "server.js"]
