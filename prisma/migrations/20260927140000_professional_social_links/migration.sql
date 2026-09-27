-- Issue #36: optional social links on professional profile
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "social_links" JSONB;
