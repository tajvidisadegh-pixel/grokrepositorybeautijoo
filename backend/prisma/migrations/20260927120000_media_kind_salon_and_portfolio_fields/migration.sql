-- Add MediaKind.salon (used by location/salon photos) and portfolio bookable fields.
-- Idempotent / non-destructive for production.

-- 1) Extend MediaKind enum with 'salon'
DO $$ BEGIN
  ALTER TYPE "MediaKind" ADD VALUE IF NOT EXISTS 'salon';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Postgres < 15 may not support IF NOT EXISTS on ADD VALUE; fallback:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'MediaKind' AND e.enumlabel = 'salon'
  ) THEN
    ALTER TYPE "MediaKind" ADD VALUE 'salon';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Portfolio / bookable metadata on media_assets
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "price" INTEGER;
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "duration_min" INTEGER;
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "title" VARCHAR(200);
