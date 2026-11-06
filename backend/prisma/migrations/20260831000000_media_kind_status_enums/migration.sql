-- Align media_assets.kind / media_assets.status with Prisma schema enums.
-- Non-destructive: creates missing types, converts VARCHAR columns in place.
-- Does NOT drop tables or delete production data.

-- 1) Enum types expected by Prisma Client
DO $$ BEGIN
  CREATE TYPE "MediaKind" AS ENUM ('avatar', 'cover', 'logo', 'portfolio', 'service');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MediaStatus" AS ENUM ('draft', 'published');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Ensure table exists (idempotent; previous migration may have created VARCHAR columns)
CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "professional_id" UUID NOT NULL,
  "professional_service_id" UUID,
  "kind" "MediaKind" NOT NULL,
  "storage_key" VARCHAR(512) NOT NULL,
  "public_url" VARCHAR(512) NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "status" "MediaStatus" NOT NULL DEFAULT 'draft',
  "sort_order" INT NOT NULL DEFAULT 0,
  "title" VARCHAR(200),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Convert kind column to MediaKind when still text/varchar
DO $$
DECLARE
  current_typ text;
BEGIN
  SELECT t.typname INTO current_typ
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  JOIN pg_type t ON a.atttypid = t.oid
  WHERE n.nspname = 'public'
    AND c.relname = 'media_assets'
    AND a.attname = 'kind'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF current_typ IS NOT NULL AND current_typ <> 'MediaKind' THEN
    ALTER TABLE "media_assets"
      ALTER COLUMN "kind" TYPE "MediaKind"
      USING ("kind"::text::"MediaKind");
  END IF;
END $$;

-- 4) Convert status column to MediaStatus when still text/varchar
DO $$
DECLARE
  current_typ text;
BEGIN
  SELECT t.typname INTO current_typ
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  JOIN pg_type t ON a.atttypid = t.oid
  WHERE n.nspname = 'public'
    AND c.relname = 'media_assets'
    AND a.attname = 'status'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF current_typ IS NOT NULL AND current_typ <> 'MediaStatus' THEN
    ALTER TABLE "media_assets" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "media_assets"
      ALTER COLUMN "status" TYPE "MediaStatus"
      USING ("status"::text::"MediaStatus");
    ALTER TABLE "media_assets"
      ALTER COLUMN "status" SET DEFAULT 'draft'::"MediaStatus";
  END IF;
END $$;

-- 5) Indexes and FKs (idempotent)
CREATE INDEX IF NOT EXISTS "media_assets_professional_id_idx" ON "media_assets"("professional_id");
CREATE INDEX IF NOT EXISTS "media_assets_kind_status_idx" ON "media_assets"("kind", "status");

DO $$ BEGIN
  ALTER TABLE "media_assets"
    ADD CONSTRAINT "media_assets_professional_id_fkey"
    FOREIGN KEY ("professional_id") REFERENCES "professionals"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "media_assets"
    ADD CONSTRAINT "media_assets_professional_service_id_fkey"
    FOREIGN KEY ("professional_service_id") REFERENCES "professional_services"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
