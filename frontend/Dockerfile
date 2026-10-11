# Frontend-only context (when Liara root directory = frontend/)
# Same contract: server.js + node_modules/next together; mirror under standalone/

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
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

RUN set -e; \
  if [ -f .next/standalone/server.js ]; then S=.next/standalone; \
  elif [ -f .next/standalone/frontend/server.js ]; then S=.next/standalone/frontend; \
  else find .next -name server.js | head; exit 1; fi; \
  if [ ! -d "$S/node_modules/next" ]; then \
    mkdir -p "$S/node_modules"; \
    cp -a node_modules/next "$S/node_modules/"; \
    for p in react react-dom styled-jsx; do \
      [ -d "node_modules/$p" ] && cp -a "node_modules/$p" "$S/node_modules/" || true; \
    done; \
  fi; \
  mkdir -p /out && cp -a "$S"/. /out/ && mkdir -p /out/.next && cp -a .next/static /out/.next/static && cp -a public /out/public

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /out/ ./
RUN mkdir -p /app/standalone \
  && cp -a /app/server.js /app/standalone/ \
  && cp -a /app/node_modules /app/standalone/ \
  && mkdir -p /app/standalone/.next && cp -a /app/.next/. /app/standalone/.next/ \
  && cp -a /app/public /app/standalone/public \
  && test -d /app/standalone/node_modules/next
EXPOSE 3000
CMD ["node", "server.js"]
