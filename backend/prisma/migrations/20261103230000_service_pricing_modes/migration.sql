-- Issue #80 Phase 1: three-layer pricing (fixed / variable / deposit)
-- All defaults keep existing catalog + professional services as fixed-only.

-- Catalog Service flags
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "allow_fixed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "allow_variable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "allow_deposit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "default_pricing_mode" VARCHAR(20) NOT NULL DEFAULT 'fixed';

-- ProfessionalService pricing mode + deposit estimates
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "pricing_mode" VARCHAR(20) NOT NULL DEFAULT 'fixed';
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "deposit_amount" INTEGER;
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "estimate_min_price" INTEGER;
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "estimate_max_price" INTEGER;
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "option_deltas" JSONB;

-- BookingItem snapshot for selected options / deposit
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "pricing_mode" VARCHAR(20);
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "is_deposit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "selected_options" JSONB;

-- Attribute groups (admin-defined structure for variable pricing)
CREATE TABLE IF NOT EXISTS "service_attribute_groups" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_id" UUID NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "name" VARCHAR(120) NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "service_attribute_groups_service_id_idx" ON "service_attribute_groups"("service_id");

CREATE TABLE IF NOT EXISTS "service_attribute_options" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL REFERENCES "service_attribute_groups"("id") ON DELETE CASCADE,
  "label" VARCHAR(120) NOT NULL,
  "suggested_price_delta" INTEGER NOT NULL DEFAULT 0,
  "suggested_duration_delta_min" INTEGER NOT NULL DEFAULT 0,
  "forces_deposit" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "service_attribute_options_group_id_idx" ON "service_attribute_options"("group_id");
