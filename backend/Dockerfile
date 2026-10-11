# Beautijoo Backend — reliable build for Liara (GitHub or ZIP)
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# package.json first (cache), prisma BEFORE npm install so generate never misses schema
COPY package.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate --schema=./prisma/schema.prisma \
  && npx nest build \
  && test -f dist/main.js \
  && mkdir -p /app/uploads \
  && chmod 755 /app/uploads

ENV NODE_ENV=production
ENV PORT=3000
# Default local path inside the container (override with a Disk mount path on Liara)
ENV STORAGE_LOCAL_PATH=/app/uploads
# Prefer object storage in production: set STORAGE_PROVIDER=s3 and S3_* secrets on Liara
ENV STORAGE_PROVIDER=local
EXPOSE 3000

# Use recovery migrate script (handles P3009 for removed failed migration), not raw prisma migrate deploy
CMD ["sh", "-c", "mkdir -p \"${STORAGE_LOCAL_PATH:-/app/uploads}\" && chmod 755 \"${STORAGE_LOCAL_PATH:-/app/uploads}\" 2>/dev/null || true; node scripts/prisma-migrate-deploy.cjs && node prisma/seed-roles.cjs && (node prisma/seed-catalog.cjs || true) && node dist/main.js"]
