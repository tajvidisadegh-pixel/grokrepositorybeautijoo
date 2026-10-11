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

COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Ensure next exists beside standalone server.js
RUN set -e; \
  SERVER=$(find .next/standalone -type f -name server.js -print -quit); \
  test -n "$SERVER"; \
  SERVER_DIR=$(dirname "$SERVER"); \
  if [ ! -d "$SERVER_DIR/node_modules/next" ]; then \
    mkdir -p "$SERVER_DIR/node_modules"; \
    cp -a node_modules/next "$SERVER_DIR/node_modules/"; \
  fi

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
