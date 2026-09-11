-- Idempotent production heal: columns/indexes expected by current Prisma schema.
-- Safe to re-run. Does not drop data.

-- Account type (customer vs professional per phone)
DO $$ BEGIN
  CREATE TYPE "AccountType" AS ENUM ('customer', 'professional');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" "AccountType" NOT NULL DEFAULT 'customer';

UPDATE "users" u
SET "account_type" = 'professional'
WHERE EXISTS (
  SELECT 1 FROM "user_roles" ur
  JOIN "roles" r ON r.id = ur.role_id
  WHERE ur.user_id = u.id AND r.name = 'professional'
) AND "account_type" = 'customer';

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_phone_key";
DROP INDEX IF EXISTS "users_phone_key";

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_phone_account_type_key" UNIQUE ("phone", "account_type");
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone");

-- Booking status timestamps + notes
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMPTZ;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "rejected_reason" VARCHAR(255);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "notes" TEXT;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'note'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'notes'
  ) THEN
    UPDATE "bookings" SET "notes" = COALESCE("notes", "note") WHERE "notes" IS NULL AND "note" IS NOT NULL;
  END IF;
END $$;

ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "booking_items_professional_service_id_idx" ON "booking_items"("professional_service_id");

-- Professional services / add-ons / media
ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "icon" VARCHAR(80);
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "buffer_min" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "service_add_ons" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "service_add_ons" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "service_add_ons" ADD COLUMN IF NOT EXISTS "extra_duration_min" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
CREATE INDEX IF NOT EXISTS "media_assets_professional_service_id_idx" ON "media_assets"("professional_service_id");

ALTER TABLE "service_price_rules" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
ALTER TABLE "service_price_rules" ADD COLUMN IF NOT EXISTS "label" VARCHAR(100);
ALTER TABLE "service_price_rules" ADD COLUMN IF NOT EXISTS "attributes" JSONB;
ALTER TABLE "service_price_rules" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
UPDATE "service_price_rules" SET "label" = 'default' WHERE "label" IS NULL;

ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "label" VARCHAR(100);
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "duration_max_min" INTEGER;
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "attributes" JSONB;
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
UPDATE "service_duration_rules" SET "label" = 'default' WHERE "label" IS NULL;

-- Payment commission snapshots
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "platform_commission_rate" DECIMAL(5,2);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "platform_commission_amount" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "professional_net_amount" INTEGER;

-- Selected categories on professionals (if used)
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "selected_category_ids" JSONB;
