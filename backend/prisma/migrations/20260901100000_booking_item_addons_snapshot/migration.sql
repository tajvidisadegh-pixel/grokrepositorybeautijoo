-- Additive: persist selected add-ons and optional price/duration rule refs on booking items
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "add_ons_snapshot" JSONB;
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "price_rule_id" UUID;
ALTER TABLE "booking_items" ADD COLUMN IF NOT EXISTS "duration_rule_id" UUID;
