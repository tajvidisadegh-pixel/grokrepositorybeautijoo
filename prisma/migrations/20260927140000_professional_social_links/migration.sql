-- Issue #36: optional socialLinks JSON on professionals (panel + public footer)
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "social_links" JSONB;
