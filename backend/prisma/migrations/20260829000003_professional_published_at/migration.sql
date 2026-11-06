-- AlterTable
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ;

-- Backfill approved professionals
UPDATE "professionals"
SET "published_at" = COALESCE("verified_at", "updated_at")
WHERE "status" = 'approved' AND "published_at" IS NULL;
