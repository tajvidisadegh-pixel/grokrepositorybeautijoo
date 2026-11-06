-- Align service models with current Prisma schema (idempotent / empty-DB safe)
ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "icon" VARCHAR(80);

ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "buffer_min" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "service_add_ons" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "service_add_ons" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "service_add_ons" ADD COLUMN IF NOT EXISTS "extra_duration_min" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
DO $$ BEGIN
  ALTER TABLE "media_assets"
    ADD CONSTRAINT "media_assets_professional_service_id_fkey"
    FOREIGN KEY ("professional_service_id") REFERENCES "professional_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "media_assets_professional_service_id_idx" ON "media_assets"("professional_service_id");

-- service_price_rules: table may already have professional_service_id + label from earlier migration
ALTER TABLE "service_price_rules" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
ALTER TABLE "service_price_rules" ADD COLUMN IF NOT EXISTS "label" VARCHAR(100);
ALTER TABLE "service_price_rules" ADD COLUMN IF NOT EXISTS "attributes" JSONB;
ALTER TABLE "service_price_rules" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
-- Backfill label without referencing a non-existent "name" column (breaks empty-DB deploy)
UPDATE "service_price_rules" SET "label" = 'default' WHERE "label" IS NULL;
ALTER TABLE "service_price_rules" DROP CONSTRAINT IF EXISTS "service_price_rules_service_id_fkey";
DO $$ BEGIN
  ALTER TABLE "service_price_rules"
    ADD CONSTRAINT "service_price_rules_professional_service_id_fkey"
    FOREIGN KEY ("professional_service_id") REFERENCES "professional_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "service_price_rules_professional_service_id_idx" ON "service_price_rules"("professional_service_id");

ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "label" VARCHAR(100);
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "duration_max_min" INTEGER;
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "attributes" JSONB;
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
UPDATE "service_duration_rules" SET "label" = 'default' WHERE "label" IS NULL;
ALTER TABLE "service_duration_rules" DROP CONSTRAINT IF EXISTS "service_duration_rules_service_id_fkey";
DO $$ BEGIN
  ALTER TABLE "service_duration_rules"
    ADD CONSTRAINT "service_duration_rules_professional_service_id_fkey"
    FOREIGN KEY ("professional_service_id") REFERENCES "professional_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "service_duration_rules_professional_service_id_idx" ON "service_duration_rules"("professional_service_id");
