# Beautijoo Backend — reliable build for Liara (GitHub or ZIP)
# #82.16: deterministic deps (npm ci + lockfile), non-root runtime, visible seed errors
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# package.json + lockfile first (cache). prisma BEFORE install so generate never misses schema.
# Prefer npm ci when package-lock.json is present (#82.16); fall back to npm install for local ZIP deploys without lock.
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN if [ -f package-lock.json ]; then npm ci; else echo "WARN: no package-lock.json — using npm install (non-deterministic)"; npm install; fi

COPY . .

RUN npx prisma generate --schema=./prisma/schema.prisma \
  && npx nest build \
  && test -f dist/main.js \
  && mkdir -p /app/uploads \
  && chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=3000
# Default local path inside the container (override with a Disk mount path on Liara)
ENV STORAGE_LOCAL_PATH=/app/uploads
# Prefer object storage in production: set STORAGE_PROVIDER=s3 and S3_* secrets on Liara
ENV STORAGE_PROVIDER=local
EXPOSE 3000

# Run as non-root (node uid 1000). For Liara Disk mounts that are root-owned,
# set the mount path env and ensure the volume is writable by uid 1000, or use S3.
USER node

# Migrate + idempotent seeds on every boot (Liara single-container pattern).
# seed-roles is required; seed-catalog is create-only / best-effort — failures are logged, not swallowed silently (#82.16).
CMD ["sh", "-c", "mkdir -p \"${STORAGE_LOCAL_PATH:-/app/uploads}\" 2>/dev/null || true; node scripts/prisma-migrate-deploy.cjs && node prisma/seed-roles.cjs && (node prisma/seed-catalog.cjs || echo \"[boot] seed-catalog failed (non-fatal, see logs above)\" >&2) && node dist/main.js"]
