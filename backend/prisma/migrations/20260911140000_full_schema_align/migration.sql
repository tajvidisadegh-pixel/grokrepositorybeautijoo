-- Mirror of ensure-runtime for migration history (idempotent)
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "parent_id" UUID;
ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "professional_locations" ADD COLUMN IF NOT EXISTS "id" UUID;
UPDATE "professional_locations" SET "id" = gen_random_uuid() WHERE "id" IS NULL;
