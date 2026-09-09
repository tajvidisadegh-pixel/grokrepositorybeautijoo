-- Separate customer vs professional accounts for the same phone number.
-- Create enum
DO $$ BEGIN
  CREATE TYPE "AccountType" AS ENUM ('customer', 'professional');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add column with default (existing rows become customer first)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" "AccountType" NOT NULL DEFAULT 'customer';

-- Promote users who already have professional role to professional account type
UPDATE "users" u
SET "account_type" = 'professional'
WHERE EXISTS (
  SELECT 1
  FROM "user_roles" ur
  JOIN "roles" r ON r.id = ur.role_id
  WHERE ur.user_id = u.id AND r.name = 'professional'
);

-- Drop global unique on phone if present
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_phone_key";

-- Composite unique: one row per (phone, account_type)
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_phone_account_type_key" UNIQUE ("phone", "account_type");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Helpful index for phone lookups
CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone");
