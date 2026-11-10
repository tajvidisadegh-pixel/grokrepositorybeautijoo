# Beautijoo Backend — reliable build for Liara (GitHub or ZIP)
# #82.16: deterministic deps (npm ci + lockfile), non-root runtime, visible seed errors
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# package.json + optional lockfile first (cache). prisma BEFORE install so generate never misses schema.
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
  && (test -f dist/main.js || test -f dist/src/main.js) \
  && mkdir -p /app/uploads \
  && chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3000
ENV STORAGE_LOCAL_PATH=/app/uploads
ENV STORAGE_PROVIDER=local
EXPOSE 3000

USER node

# Longer start-period: migrate + seed on cold start can exceed 60s on Liara.
HEALTHCHECK --interval=30s --timeout=8s --start-period=180s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>process.exit(r.statusCode&&r.statusCode<500?0:1))}).on('error',()=>process.exit(1))"

# Boot: migrate (required) → seed-roles (required) → optional catalog → app.
# Use dist/main.js or dist/src/main.js depending on nest layout.
CMD ["sh", "-c", "set -e; mkdir -p \"${STORAGE_LOCAL_PATH:-/app/uploads}\" 2>/dev/null || true; echo \"[boot] migrate...\"; node scripts/prisma-migrate-deploy.cjs; echo \"[boot] seed-roles...\"; node prisma/seed-roles.cjs; if [ \"${RUN_SEED_CATALOG_ON_BOOT:-false}\" = \"true\" ]; then (node prisma/seed-catalog.cjs || echo \"[boot] seed-catalog failed (non-fatal)\" >&2); else echo \"[boot] seed-catalog skipped\"; fi; MAIN=dist/main.js; if [ ! -f \"$MAIN\" ]; then MAIN=dist/src/main.js; fi; echo \"[boot] starting $MAIN\"; exec node \"$MAIN\""]
