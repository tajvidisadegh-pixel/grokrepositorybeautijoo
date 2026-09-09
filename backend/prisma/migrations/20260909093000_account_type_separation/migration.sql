-- Account type separation: same phone may be customer AND professional as separate users.
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
);

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_phone_key";

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_phone_account_type_key" UNIQUE ("phone", "account_type");
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone");
