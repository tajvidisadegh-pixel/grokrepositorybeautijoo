-- Booking status timestamps + rename note -> notes + booking_item professional_service_id / sort_order
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMPTZ;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "rejected_reason" VARCHAR(255);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'note'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'notes'
  ) THEN
    ALTER TABLE "bookings" RENAME COLUMN "note" TO "notes";
  END IF;
END $$;

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "professional_service_id" UUID;
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "booking_items_professional_service_id_idx" ON "booking_items"("professional_service_id");
