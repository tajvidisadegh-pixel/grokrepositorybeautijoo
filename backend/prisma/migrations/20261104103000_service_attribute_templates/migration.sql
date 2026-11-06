-- #80 Phase 2: reusable attribute templates (copy-on-apply, not live link)
CREATE TABLE IF NOT EXISTS "service_attribute_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "category_id" UUID,
  "payload" JSONB NOT NULL DEFAULT '[]',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_attribute_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "service_attribute_templates_is_active_idx" ON "service_attribute_templates" ("is_active");
CREATE INDEX IF NOT EXISTS "service_attribute_templates_category_id_idx" ON "service_attribute_templates" ("category_id");
