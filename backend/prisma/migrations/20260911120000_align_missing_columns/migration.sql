-- Runtime schema heal — fully idempotent. Safe on every boot. No data loss.

-- services.sort_order (P2022 on listCategories)
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

-- service_categories.parent_id (tree)
ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "parent_id" UUID;
ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "icon" VARCHAR(80);

-- professional_locations.id (Prisma expects UUID PK; init had composite PK only)
ALTER TABLE "professional_locations" ADD COLUMN IF NOT EXISTS "id" UUID;

UPDATE "professional_locations"
SET "id" = gen_random_uuid()
WHERE "id" IS NULL;

DO $$ BEGIN
  -- Drop composite primary key if it is still the old one
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'professional_locations_pkey'
      AND contype = 'p'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'professional_locations' AND column_name = 'id'
  ) THEN
    -- Only rewrite PK if id is not already the sole PK column
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'professional_locations'
        AND c.contype = 'p'
        AND pg_get_constraintdef(c.oid) LIKE '%professional_id%'
    ) THEN
      ALTER TABLE "professional_locations" DROP CONSTRAINT "professional_locations_pkey";
      ALTER TABLE "professional_locations" ALTER COLUMN "id" SET NOT NULL;
      ALTER TABLE "professional_locations" ADD CONSTRAINT "professional_locations_pkey" PRIMARY KEY ("id");
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'professional_locations PK adjust: %', SQLERRM;
END $$;

-- Ensure unique pair still exists after PK change
DO $$ BEGIN
  ALTER TABLE "professional_locations"
    ADD CONSTRAINT "professional_locations_professional_id_location_id_key"
    UNIQUE ("professional_id", "location_id");
EXCEPTION WHEN duplicate_object THEN null;
WHEN duplicate_table THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "professional_locations_professional_id_idx"
  ON "professional_locations"("professional_id");
CREATE INDEX IF NOT EXISTS "professional_locations_location_id_idx"
  ON "professional_locations"("location_id");

-- professionals extra columns
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "logo_url" VARCHAR(512);
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "selected_category_ids" JSONB;

-- working_hours.is_closed
ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "is_closed" BOOLEAN NOT NULL DEFAULT false;

-- users.account_type
DO $$ BEGIN
  CREATE TYPE "AccountType" AS ENUM ('customer', 'professional');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" "AccountType" NOT NULL DEFAULT 'customer';

-- bookings timestamps / notes
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMPTZ;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "rejected_reason" VARCHAR(255);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- booking_items
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "add_ons_snapshot" JSONB;
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "price_rule_id" UUID;
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "duration_rule_id" UUID;

-- payments commission
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "platform_commission_rate" DECIMAL(5,2);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "platform_commission_amount" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "professional_net_amount" INTEGER;

-- professional_services
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "buffer_min" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- media / addons
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
ALTER TABLE "service_add_ons" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "service_add_ons" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "service_add_ons" ADD COLUMN IF NOT EXISTS "extra_duration_min" INTEGER NOT NULL DEFAULT 0;
