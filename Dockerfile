# Frontend image for Liara (repo-root connection).
# Isolated frontend install+build so Next standalone includes a complete `next` tree.
# Do NOT partially cp next (breaks ESM under node_modules/next/dist/...).

FROM node:22-bookworm-slim AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PUBLIC_API_TIMEOUT_MS=8000
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

# Support Liara start at /app/standalone/server.js with FULL tree (not nested frontend/)
RUN mkdir -p /app/standalone \
  && cp -a /app/server.js /app/standalone/server.js \
  && cp -a /app/node_modules /app/standalone/node_modules \
  && mkdir -p /app/standalone/.next \
  && cp -a /app/.next/. /app/standalone/.next/ \
  && cp -a /app/public /app/standalone/public

EXPOSE 3000
CMD ["node", "server.js"]
