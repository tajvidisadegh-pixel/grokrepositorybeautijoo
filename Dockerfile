# Frontend image for Liara (repo-root connection).
# Isolated frontend install+build so Next standalone includes a complete `next` tree.
# Do NOT partially cp next (breaks ESM under node_modules/next/dist/...).

FROM node:22-bookworm-slim AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV PUBLIC_API_TIMEOUT_MS=8000
ENV DOCKER_STANDALONE=1
# NOTE: Do NOT set NODE_ENV=production here — npm would skip devDependencies
# (typescript, tailwind, postcss, eslint-config-next) and `next build` fails.

ARG NEXT_PUBLIC_API_URL=https://api.beautijoo.ir/api/v1
ARG NEXT_PUBLIC_APP_URL=https://beautijoo.ir
ARG NEXT_PUBLIC_APP_NAME=Beautijoo
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

COPY frontend/package.json frontend/package-lock.json* ./

# Prefer reproducible npm ci when lock exists; fall back so Liara build is not blocked
# when frontend/package-lock.json is absent from the repo.
# Explicit --include=dev so install works even if NODE_ENV is later set to production.
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && if [ -f package-lock.json ]; then \
       npm ci --include=dev; \
     else \
       npm install --include=dev; \
     fi

COPY frontend/ ./

# Now production for the actual Next build
ENV NODE_ENV=production
RUN npm run build

RUN set -e; \
  if [ -f .next/standalone/server.js ]; then :; \
  elif [ -f .next/standalone/frontend/server.js ]; then \
    cp -a .next/standalone/frontend/. .next/standalone/ && rm -rf .next/standalone/frontend; \
  else find .next -name server.js; exit 1; fi; \
  test -f .next/standalone/server.js; \
  test -d .next/standalone/node_modules/next

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# #r4.D2/D3 — Liara may start either /app/server.js or /app/standalone/server.js
# Prefer symlink for standalone path instead of duplicating node_modules (image size).
RUN mkdir -p /app/standalone \
  && ln -sf /app/server.js /app/standalone/server.js \
  && ln -sfn /app/node_modules /app/standalone/node_modules \
  && mkdir -p /app/standalone/.next \
  && ln -sfn /app/.next/static /app/standalone/.next/static \
  && ln -sfn /app/public /app/standalone/public

# #r4.D1 — run as non-root
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000),r=>process.exit(r.statusCode&&r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server.js"]
