-- Catalog add-on templates (#30)
CREATE TABLE IF NOT EXISTS "catalog_add_ons" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "default_price" INTEGER NOT NULL DEFAULT 0,
    "default_extra_duration_min" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "catalog_add_ons_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "catalog_add_ons_is_active_idx" ON "catalog_add_ons"("is_active");
CREATE INDEX IF NOT EXISTS "catalog_add_ons_sort_order_idx" ON "catalog_add_ons"("sort_order");
