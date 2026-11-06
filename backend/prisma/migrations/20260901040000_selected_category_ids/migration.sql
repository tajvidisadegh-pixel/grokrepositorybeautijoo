-- Additive: preferred root categories for professional specialties UX
ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "selected_category_ids" JSONB;
