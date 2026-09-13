-- Fix P2022: working_hours.created_at / updated_at missing on some production DBs
ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "is_closed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
