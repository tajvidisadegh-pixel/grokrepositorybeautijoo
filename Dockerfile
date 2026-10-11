FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PUBLIC_API_TIMEOUT_MS=12000

# NEXT_PUBLIC_* are baked into the client bundle at build time.
ARG NEXT_PUBLIC_API_URL=https://api.beautijoo.ir/api/v1
ARG NEXT_PUBLIC_APP_URL=https://beautijoo.ir
ARG NEXT_PUBLIC_APP_NAME=Beautijoo
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

COPY package.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm install --include=dev

COPY frontend ./frontend

RUN npm run build

# Fail early if standalone missing
RUN test -n "$(find /app/frontend/.next/standalone -type f -name server.js -print -quit)"

# If workspace hoist left `next` outside standalone, copy it beside server.js
RUN set -e; \
  SERVER=$(find /app/frontend/.next/standalone -type f -name server.js -print -quit); \
  SERVER_DIR=$(dirname "$SERVER"); \
  if [ ! -d "$SERVER_DIR/node_modules/next" ]; then \
    echo "Patching next into standalone at $SERVER_DIR"; \
    mkdir -p "$SERVER_DIR/node_modules"; \
    if [ -d /app/node_modules/next ]; then cp -a /app/node_modules/next "$SERVER_DIR/node_modules/"; \
    elif [ -d /app/frontend/node_modules/next ]; then cp -a /app/frontend/node_modules/next "$SERVER_DIR/node_modules/"; \
    else echo "ERROR: next package not found to copy"; exit 1; fi; \
    for p in react react-dom styled-jsx; do \
      if [ -d "/app/node_modules/$p" ]; then cp -a "/app/node_modules/$p" "$SERVER_DIR/node_modules/" || true; fi; \
      if [ -d "/app/frontend/node_modules/$p" ]; then cp -a "/app/frontend/node_modules/$p" "$SERVER_DIR/node_modules/" || true; fi; \
    done; \
  fi; \
  test -d "$SERVER_DIR/node_modules/next"

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Same layout as the previously working image
COPY --from=builder /app/frontend/.next/standalone ./standalone
COPY --from=builder /app/frontend/.next/static ./next-static
COPY --from=builder /app/frontend/public ./next-public

EXPOSE 3000

# Locate server.js, attach static/public, start from that directory (resolves next)
CMD ["sh", "-c", "SERVER=$(find /app/standalone -type f -name server.js -print -quit); test -n \"$SERVER\"; SERVER_DIR=$(dirname \"$SERVER\"); mkdir -p \"$SERVER_DIR/.next\"; cp -a /app/next-static \"$SERVER_DIR/.next/static\"; cp -a /app/next-public \"$SERVER_DIR/public\"; cd \"$SERVER_DIR\"; exec node \"$(basename \"$SERVER\")\""]
