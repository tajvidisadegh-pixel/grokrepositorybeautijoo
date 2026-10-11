-- Review reply fields + PayoutRequest (#8, #9)
DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'approved', 'paid', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "professional_reply" TEXT;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "replied_at" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "payout_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "professional_id" UUID NOT NULL,
  "amount" INTEGER NOT NULL,
  "note" VARCHAR(500),
  "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
  "admin_note" VARCHAR(500),
  "resolved_at" TIMESTAMPTZ,
  "resolved_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_professional_id_fkey"
    FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "payout_requests_professional_id_status_idx" ON "payout_requests"("professional_id", "status");
CREATE INDEX IF NOT EXISTS "payout_requests_status_created_at_idx" ON "payout_requests"("status", "created_at");
