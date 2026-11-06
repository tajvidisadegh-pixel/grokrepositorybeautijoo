-- Issue #36: optional socialLinks JSON on professionals (panel + public footer)
-- Issue #37: admin channel roles use Role/Permission seed only (no schema change)
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "social_links" JSONB;
