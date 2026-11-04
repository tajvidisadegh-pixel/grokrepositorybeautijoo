-- #76 — no_show is not cancel: dedicated timestamp and reason
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "no_show_at" TIMESTAMPTZ;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "no_show_reason" VARCHAR(255);
