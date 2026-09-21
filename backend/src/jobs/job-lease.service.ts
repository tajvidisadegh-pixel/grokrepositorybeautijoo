import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

/**
 * Distributed job lease using PostgreSQL (no Redis required).
 * Prevents overlapping runs across multiple app instances for periodic jobs.
 * Transaction-safe via conditional UPSERT on locked_until.
 */
@Injectable()
export class JobLeaseService implements OnModuleInit {
  private readonly logger = new Logger(JobLeaseService.name);
  private readonly holder = `${process.pid}-${randomUUID().slice(0, 8)}`;
  private tableReady = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureTable();
  }

  private async ensureTable(): Promise<void> {
    if (this.tableReady) return;
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS job_leases (
          name TEXT PRIMARY KEY,
          locked_until TIMESTAMPTZ NOT NULL,
          holder TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      this.tableReady = true;
    } catch (err) {
      this.logger.warn(
        `job_leases table ensure failed: ${(err as Error)?.message} — jobs may overlap on multi-instance`,
      );
    }
  }

  /**
   * Try to acquire lease for `name` for `ttlMs` milliseconds.
   * Returns true if this process holds the lease.
   */
  async tryAcquire(name: string, ttlMs: number): Promise<boolean> {
    await this.ensureTable();
    if (!this.tableReady) return true; // degrade: allow run (single-instance safe path)

    const now = new Date();
    const until = new Date(now.getTime() + Math.max(ttlMs, 5_000));

    try {
      // Insert or steal expired lease
      const rows = await this.prisma.$queryRaw<Array<{ name: string }>>`
        INSERT INTO job_leases (name, locked_until, holder, updated_at)
        VALUES (${name}, ${until}, ${this.holder}, ${now})
        ON CONFLICT (name) DO UPDATE
          SET locked_until = EXCLUDED.locked_until,
              holder = EXCLUDED.holder,
              updated_at = EXCLUDED.updated_at
          WHERE job_leases.locked_until < ${now}
        RETURNING name
      `;
      return Array.isArray(rows) && rows.length > 0;
    } catch (err) {
      this.logger.warn(`tryAcquire(${name}) failed: ${(err as Error)?.message}`);
      return true; // fail-open for availability of cleanup
    }
  }

  /** Extend lease while long job runs (optional). */
  async renew(name: string, ttlMs: number): Promise<void> {
    if (!this.tableReady) return;
    const now = new Date();
    const until = new Date(now.getTime() + Math.max(ttlMs, 5_000));
    try {
      await this.prisma.$executeRaw`
        UPDATE job_leases
        SET locked_until = ${until}, updated_at = ${now}
        WHERE name = ${name} AND holder = ${this.holder}
      `;
    } catch {
      /* ignore */
    }
  }

  async release(name: string): Promise<void> {
    if (!this.tableReady) return;
    try {
      await this.prisma.$executeRaw`
        UPDATE job_leases
        SET locked_until = ${new Date(0)}, updated_at = ${new Date()}
        WHERE name = ${name} AND holder = ${this.holder}
      `;
    } catch {
      /* ignore */
    }
  }

  /**
   * Run fn only if lease acquired. Always releases/expires on exit.
   * Returns null if another instance holds the lock.
   */
  async withLease<T>(
    name: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const ok = await this.tryAcquire(name, ttlMs);
    if (!ok) {
      this.logger.debug(`job skipped (lease held): ${name}`);
      return null;
    }
    try {
      return await fn();
    } finally {
      await this.release(name);
    }
  }
}
