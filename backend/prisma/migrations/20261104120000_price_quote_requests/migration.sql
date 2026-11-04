-- #80 Phase 3: price quote requests with optional photos (auxiliary path)
CREATE TABLE IF NOT EXISTS "price_quote_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "customer_id" UUID NOT NULL,
  "professional_id" UUID NOT NULL,
  "professional_service_id" UUID,
  "note" TEXT,
  "photo_urls" JSONB NOT NULL DEFAULT '[]',
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "quoted_price" INTEGER,
  "quoted_duration_min" INTEGER,
  "response_note" TEXT,
  "responded_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_quote_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "price_quote_requests_customer_id_idx" ON "price_quote_requests" ("customer_id");
CREATE INDEX IF NOT EXISTS "price_quote_requests_professional_id_idx" ON "price_quote_requests" ("professional_id");
CREATE INDEX IF NOT EXISTS "price_quote_requests_status_idx" ON "price_quote_requests" ("status");
CREATE INDEX IF NOT EXISTS "price_quote_requests_created_at_idx" ON "price_quote_requests" ("created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_quote_requests_customer_id_fkey') THEN
    ALTER TABLE "price_quote_requests"
      ADD CONSTRAINT "price_quote_requests_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_quote_requests_professional_id_fkey') THEN
    ALTER TABLE "price_quote_requests"
      ADD CONSTRAINT "price_quote_requests_professional_id_fkey"
      FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_quote_requests_professional_service_id_fkey') THEN
    ALTER TABLE "price_quote_requests"
      ADD CONSTRAINT "price_quote_requests_professional_service_id_fkey"
      FOREIGN KEY ("professional_service_id") REFERENCES "professional_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
