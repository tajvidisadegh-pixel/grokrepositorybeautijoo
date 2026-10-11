-- Add media_assets.url required by Prisma MediaAsset
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "url" VARCHAR(512);
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "storage_key" VARCHAR(512);
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "mime_type" VARCHAR(100);
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "size_bytes" INTEGER;
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "status" "MediaStatus" DEFAULT 'draft';

UPDATE "media_assets"
SET "url" = COALESCE(NULLIF("url", ''), NULLIF("public_url", ''), NULLIF("storage_key", ''), '')
WHERE "url" IS NULL OR "url" = '';

UPDATE "media_assets" SET "url" = '' WHERE "url" IS NULL;

DO $$ BEGIN
  ALTER TABLE "media_assets" ALTER COLUMN "url" SET DEFAULT '';
  ALTER TABLE "media_assets" ALTER COLUMN "url" SET NOT NULL;
EXCEPTION WHEN others THEN null;
END $$;
