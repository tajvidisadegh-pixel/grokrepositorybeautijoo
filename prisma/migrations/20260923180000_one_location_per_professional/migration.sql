-- Issue #21: one Location per Professional + precision (exact | approximate)

-- 1) precision column (safe default approximate)
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "precision" VARCHAR(20) NOT NULL DEFAULT 'approximate';

-- Infer approximate from address text when present (no dependency on lat/lng column names)
UPDATE "locations"
SET "precision" = 'approximate'
WHERE "address" ILIKE '%محدوده%';

-- Infer exact only if a latitude-like column exists (lat OR latitude)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locations' AND column_name = 'lat'
  ) THEN
    UPDATE "locations"
    SET "precision" = 'exact'
    WHERE "lat" IS NOT NULL
      AND ("address" IS NULL OR "address" NOT ILIKE '%محدوده%');
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'locations' AND column_name = 'latitude'
  ) THEN
    UPDATE "locations"
    SET "precision" = 'exact'
    WHERE "latitude" IS NOT NULL
      AND ("address" IS NULL OR "address" NOT ILIKE '%محدوده%');
  END IF;
END $$;

-- 2) Dedupe professional_locations: keep primary first, else oldest by id
DELETE FROM "professional_locations" pl
WHERE pl."id" NOT IN (
  SELECT kept.id FROM (
    SELECT DISTINCT ON (professional_id) id
    FROM "professional_locations"
    ORDER BY professional_id, is_primary DESC, id ASC
  ) kept
);

-- 3) Enforce one row per professional
CREATE UNIQUE INDEX IF NOT EXISTS "professional_locations_professional_id_key"
  ON "professional_locations"("professional_id");
