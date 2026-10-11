-- Admin-managed filter taxonomy per catalog specialty.
CREATE TYPE "ServiceCategoryAssignmentStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "service_category_services" (
  "service_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_category_services_pkey" PRIMARY KEY ("service_id", "category_id"),
  CONSTRAINT "service_category_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "service_category_services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "service_category_services_category_id_idx" ON "service_category_services"("category_id");
CREATE INDEX "service_category_services_active_order_idx" ON "service_category_services"("is_active", "sort_order");

CREATE TABLE "professional_service_categories" (
  "professional_service_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "status" "ServiceCategoryAssignmentStatus" NOT NULL DEFAULT 'pending',
  "reviewed_at" TIMESTAMPTZ,
  "reviewed_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "professional_service_categories_pkey" PRIMARY KEY ("professional_service_id", "category_id"),
  CONSTRAINT "professional_service_categories_ps_fkey" FOREIGN KEY ("professional_service_id") REFERENCES "professional_services"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "professional_service_categories_category_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "professional_service_categories_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "professional_service_categories_category_id_idx" ON "professional_service_categories"("category_id");
CREATE INDEX "professional_service_categories_status_idx" ON "professional_service_categories"("status");
CREATE INDEX "professional_service_categories_reviewed_by_idx" ON "professional_service_categories"("reviewed_by");
