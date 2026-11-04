-- #80 Phase 2.3: optional service variants (sub-services under a parent catalog service)
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "parent_id" UUID;

CREATE INDEX IF NOT EXISTS "services_parent_id_idx" ON "services" ("parent_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_parent_id_fkey'
  ) THEN
    ALTER TABLE "services"
      ADD CONSTRAINT "services_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "services"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
