-- Service Add-ons (professional-specific extras on ProfessionalService)
-- Safe additive migration: no DROP / TRUNCATE

CREATE TABLE IF NOT EXISTS "service_add_ons" (
    "id" UUID NOT NULL,
    "professional_service_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "extra_duration_min" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_add_ons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "service_add_ons_professional_service_id_is_active_idx"
  ON "service_add_ons"("professional_service_id", "is_active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_add_ons_professional_service_id_fkey'
  ) THEN
    ALTER TABLE "service_add_ons"
      ADD CONSTRAINT "service_add_ons_professional_service_id_fkey"
      FOREIGN KEY ("professional_service_id") REFERENCES "professional_services"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Helpful indexes for shared library / analytics (idempotent)
CREATE INDEX IF NOT EXISTS "professional_services_service_id_idx"
  ON "professional_services"("service_id");

CREATE INDEX IF NOT EXISTS "media_assets_professional_service_id_idx"
  ON "media_assets"("professional_service_id");
