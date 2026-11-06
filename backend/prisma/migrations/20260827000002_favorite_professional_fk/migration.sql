-- Favorite → Professional FK (was missing; professional_id was orphan UUID)
ALTER TABLE "favorites"
  ADD CONSTRAINT "favorites_professional_id_fkey"
  FOREIGN KEY ("professional_id") REFERENCES "professionals"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "favorites_professional_id_idx"
  ON "favorites"("professional_id");
