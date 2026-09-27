-- Issue #36: optional social links on professional profile (panel + public page)
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "social_links" JSONB;
