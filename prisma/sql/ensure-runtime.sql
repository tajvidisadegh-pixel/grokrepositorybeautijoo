-- FULL schema alignment (idempotent). Run on every boot before app starts.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN CREATE TYPE "UserStatus" AS ENUM ('active','inactive','suspended','deleted'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "AccountType" AS ENUM ('customer','professional'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ProfessionalStatus" AS ENUM ('draft','pending_review','approved','rejected','suspended'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "BookingStatus" AS ENUM ('pending','confirmed','rejected','cancelled','completed','expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PaymentStatus" AS ENUM ('pending','processing','paid','failed','refunded','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "NotificationType" AS ENUM ('booking_request','booking_confirmed','booking_rejected','booking_cancelled','booking_completed','booking_reminder','review_request','system','otp'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "DayOfWeek" AS ENUM ('saturday','sunday','monday','tuesday','wednesday','thursday','friday'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "Gender" AS ENUM ('female','male','other','undisclosed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MediaKind" AS ENUM ('avatar','cover','logo','portfolio','service'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MediaStatus" AS ENUM ('draft','published'); EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" "AccountType" NOT NULL DEFAULT 'customer';
CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone");
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_phone_key";
DROP INDEX IF EXISTS "users_phone_key";
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_account_type_key') THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_phone_account_type_key" UNIQUE ("phone", "account_type");
  END IF;
EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;

ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "services_category_id_idx" ON "services"("category_id");
CREATE INDEX IF NOT EXISTS "services_is_active_idx" ON "services"("is_active");

ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "parent_id" UUID;
ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "service_categories" ADD COLUMN IF NOT EXISTS "icon" VARCHAR(80);
CREATE INDEX IF NOT EXISTS "service_categories_parent_id_idx" ON "service_categories"("parent_id");

ALTER TABLE "professional_locations" ADD COLUMN IF NOT EXISTS "id" UUID;
UPDATE "professional_locations" SET "id" = gen_random_uuid() WHERE "id" IS NULL;
ALTER TABLE "professional_locations" ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN NOT NULL DEFAULT false;
DO $$
DECLARE pkdef text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO pkdef
  FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'professional_locations' AND c.contype = 'p' LIMIT 1;
  IF pkdef IS NOT NULL AND pkdef LIKE '%professional_id%' THEN
    ALTER TABLE "professional_locations" DROP CONSTRAINT "professional_locations_pkey";
    ALTER TABLE "professional_locations" ALTER COLUMN "id" SET NOT NULL;
    ALTER TABLE "professional_locations" ADD CONSTRAINT "professional_locations_pkey" PRIMARY KEY ("id");
  ELSIF pkdef IS NULL THEN
    UPDATE "professional_locations" SET "id" = gen_random_uuid() WHERE "id" IS NULL;
    ALTER TABLE "professional_locations" ALTER COLUMN "id" SET NOT NULL;
    ALTER TABLE "professional_locations" ADD CONSTRAINT "professional_locations_pkey" PRIMARY KEY ("id");
  END IF;
EXCEPTION WHEN others THEN RAISE NOTICE 'professional_locations PK: %', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE "professional_locations" ADD CONSTRAINT "professional_locations_professional_id_location_id_key" UNIQUE ("professional_id", "location_id");
EXCEPTION WHEN duplicate_object THEN null; WHEN duplicate_table THEN null; END $$;
CREATE INDEX IF NOT EXISTS "professional_locations_professional_id_idx" ON "professional_locations"("professional_id");
CREATE INDEX IF NOT EXISTS "professional_locations_location_id_idx" ON "professional_locations"("location_id");

ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "logo_url" VARCHAR(512);
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "cover_image_url" VARCHAR(512);
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "selected_category_ids" JSONB;
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "buffer_min" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "professional_services" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- working_hours (P2022 on Liara: created_at missing)
ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "is_closed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancel_reason" VARCHAR(255);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "rejected_reason" VARCHAR(255);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMPTZ;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;

ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "add_ons_snapshot" JSONB;
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "price_rule_id" UUID;
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "duration_rule_id" UUID;

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "platform_commission_rate" DECIMAL(5,2);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "platform_commission_amount" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "professional_net_amount" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- ========== MEDIA ASSETS (matches Prisma MediaAsset: url required) ==========
CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" UUID NOT NULL,
  "professional_id" UUID,
  "professional_service_id" UUID,
  "kind" "MediaKind" NOT NULL DEFAULT 'portfolio',
  "status" "MediaStatus" NOT NULL DEFAULT 'draft',
  "url" VARCHAR(512) NOT NULL DEFAULT '',
  "storage_key" VARCHAR(512),
  "mime_type" VARCHAR(100),
  "size_bytes" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "professional_id" UUID;
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "kind" "MediaKind";
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "status" "MediaStatus" DEFAULT 'draft';
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "url" VARCHAR(512);
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "storage_key" VARCHAR(512);
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "public_url" VARCHAR(512);
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "mime_type" VARCHAR(100);
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "size_bytes" INTEGER;
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "title" VARCHAR(200);
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE "media_assets"
SET "url" = COALESCE(
  NULLIF("url", ''),
  NULLIF("public_url", ''),
  NULLIF("storage_key", ''),
  ''
)
WHERE "url" IS NULL OR "url" = '';

UPDATE "media_assets" SET "url" = '' WHERE "url" IS NULL;

DO $$ BEGIN
  ALTER TABLE "media_assets" ALTER COLUMN "url" SET DEFAULT '';
  ALTER TABLE "media_assets" ALTER COLUMN "url" SET NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'media_assets.url NOT NULL: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS "media_assets_professional_id_kind_idx" ON "media_assets"("professional_id", "kind");
CREATE INDEX IF NOT EXISTS "media_assets_professional_service_id_idx" ON "media_assets"("professional_service_id");

ALTER TABLE "service_add_ons" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "service_add_ons" ADD COLUMN IF NOT EXISTS "extra_duration_min" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "service_add_ons" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "service_price_rules" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
ALTER TABLE "service_price_rules" ADD COLUMN IF NOT EXISTS "label" VARCHAR(100);
ALTER TABLE "service_price_rules" ADD COLUMN IF NOT EXISTS "attributes" JSONB;
ALTER TABLE "service_price_rules" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "service_price_rules" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "label" VARCHAR(100);
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "duration_min" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "duration_max_min" INTEGER;
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "attributes" JSONB;
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "service_duration_rules" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "name" VARCHAR(120);
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "province" VARCHAR(80);
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "postal_code" VARCHAR(20);
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "lat" DECIMAL(10,7);
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "lng" DECIMAL(10,7);
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
