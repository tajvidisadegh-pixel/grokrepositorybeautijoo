# Beautijoo Backend — reliable build for Liara (GitHub or ZIP)
# #82.16: deterministic deps (npm ci + lockfile), non-root runtime, visible seed errors
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# package.json + optional lockfile first (cache). prisma BEFORE install so generate never misses schema.
# Prefer npm ci when package-lock.json is present; otherwise npm install so deploy is not blocked.
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN if [ -f package-lock.json ]; then \
      npm ci; \
    else \
      echo "WARN: package-lock.json missing — using npm install (non-reproducible)" >&2; \
      npm install --no-audit --no-fund; \
    fi

COPY . .

RUN npx prisma generate --schema=./prisma/schema.prisma \
  && npx nest build \
  && test -f dist/main.js \
  && mkdir -p /app/uploads \
  && chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_LOCAL_PATH=/app/uploads
ENV STORAGE_PROVIDER=local
EXPOSE 3000

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health',r=>process.exit(r.statusCode&&r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["sh", "-c", "mkdir -p \"${STORAGE_LOCAL_PATH:-/app/uploads}\" 2>/dev/null || true; node scripts/prisma-migrate-deploy.cjs && node prisma/seed-roles.cjs && if [ \"${RUN_SEED_CATALOG_ON_BOOT:-false}\" = \"true\" ]; then (node prisma/seed-catalog.cjs || echo \"[boot] seed-catalog failed (non-fatal)\" >&2); else echo \"[boot] seed-catalog skipped (set RUN_SEED_CATALOG_ON_BOOT=true to enable)\"; fi && node dist/main.js"]
