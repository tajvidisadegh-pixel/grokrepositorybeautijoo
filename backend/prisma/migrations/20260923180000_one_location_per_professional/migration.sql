-- Issue #21: one Location per Professional + precision (exact | approximate)

-- 1) precision column
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "precision" VARCHAR(20) NOT NULL DEFAULT 'approximate';

-- Infer exact where coords look precise (more than 2 decimal places effectively stored)
UPDATE "locations"
SET "precision" = 'exact'
WHERE "lat" IS NOT NULL AND "lng" IS NOT NULL
  AND ("address" IS NULL OR "address" NOT ILIKE '%محدوده%');

UPDATE "locations"
SET "precision" = 'approximate'
WHERE "address" ILIKE '%محدوده%';

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
