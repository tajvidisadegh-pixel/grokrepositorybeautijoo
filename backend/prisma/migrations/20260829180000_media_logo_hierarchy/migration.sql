ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "logo_url" VARCHAR(512);
ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "parent_id" UUID;
DO $$ BEGIN
  ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "service_categories_parent_id_idx" ON "service_categories"("parent_id");

CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "professional_id" UUID NOT NULL REFERENCES "professionals"("id") ON DELETE CASCADE,
  "professional_service_id" UUID REFERENCES "professional_services"("id") ON DELETE SET NULL,
  "kind" VARCHAR(40) NOT NULL,
  "storage_key" VARCHAR(512) NOT NULL,
  "public_url" VARCHAR(512) NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
  "sort_order" INT NOT NULL DEFAULT 0,
  "title" VARCHAR(200),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "media_assets_professional_id_idx" ON "media_assets"("professional_id");
CREATE INDEX IF NOT EXISTS "media_assets_kind_status_idx" ON "media_assets"("kind", "status");

CREATE TABLE IF NOT EXISTS "service_price_rules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "professional_service_id" UUID NOT NULL REFERENCES "professional_services"("id") ON DELETE CASCADE,
  "label" VARCHAR(200) NOT NULL,
  "attributes" JSONB,
  "price" INT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "service_price_rules_ps_idx" ON "service_price_rules"("professional_service_id");

CREATE TABLE IF NOT EXISTS "service_duration_rules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "professional_service_id" UUID NOT NULL REFERENCES "professional_services"("id") ON DELETE CASCADE,
  "label" VARCHAR(200) NOT NULL,
  "attributes" JSONB,
  "duration_min" INT NOT NULL,
  "duration_max_min" INT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "service_duration_rules_ps_idx" ON "service_duration_rules"("professional_service_id");
