import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Second-line schema heal on every process start.
 * Boot script (prisma-migrate-deploy.cjs) is primary; this catches residual drift
 * if an older image or failed db push left critical columns missing.
 */
const CRITICAL_HEALS = [
  `ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "is_closed" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "working_hours" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "logo_url" VARCHAR(512)`,
  `ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "cover_image_url" VARCHAR(512)`,
  `ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ`,
  `ALTER TABLE "professionals" ADD COLUMN IF NOT EXISTS "selected_category_ids" JSONB`,
  `ALTER TABLE "media_assets" ADD COLUMN IF NOT EXISTS "url" VARCHAR(512)`,
  `ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
];

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    await this.healCriticalColumns();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async healCriticalColumns() {
    for (const sql of CRITICAL_HEALS) {
      try {
        await this.$executeRawUnsafe(sql);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Enum AccountType may not exist yet; ignore and let boot migrate handle full ensure
        this.logger.warn(`schema heal skipped: ${msg.slice(0, 160)}`);
      }
    }
    this.logger.log('critical schema heal pass completed');
  }
}
