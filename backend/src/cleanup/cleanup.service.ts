import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, MediaStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER, type StorageProvider } from '../storage/storage.provider';
import { JobLeaseService } from '../jobs/job-lease.service';

export type CleanupStats = {
  otpsDeleted: number;
  refreshTokensDeleted: number;
  sessionsDeleted: number;
  bookingsCompleted: number;
  mediaOrphansDeleted: number;
};

@Injectable()
export class CleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CleanupService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly jobLease: JobLeaseService,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>('CLEANUP_ENABLED') !== 'false';
    if (!enabled) {
      this.logger.log('Periodic cleanup disabled (CLEANUP_ENABLED=false)');
      return;
    }
    const intervalMs = this.resolveIntervalMs();
    setTimeout(() => void this.safeRun(), 15_000);
    this.timer = setInterval(() => void this.safeRun(), intervalMs);
    this.logger.log(`Periodic cleanup scheduled every ${Math.round(intervalMs / 60_000)} min`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private resolveIntervalMs(): number {
    const min = parseInt(process.env.CLEANUP_INTERVAL_MINUTES || '60', 10);
    if (Number.isNaN(min) || min < 5) return 60 * 60_000;
    return min * 60_000;
  }

  private async safeRun(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // Lease ~10 min so multi-instance deploys do not double-run cleanup (#18.2)
      const stats = await this.jobLease.withLease('cleanup', 10 * 60_000, () =>
        this.runAllWithRetry(),
      );
      if (!stats) return;
      this.logger.log(
        `Cleanup done: otp=${stats.otpsDeleted} refresh=${stats.refreshTokensDeleted} ` +
          `sessions=${stats.sessionsDeleted} bookingsCompleted=${stats.bookingsCompleted} ` +
          `mediaOrphans=${stats.mediaOrphansDeleted}`,
      );
    } catch (err) {
      this.logger.error(`Cleanup failed: ${(err as Error)?.message}`);
    } finally {
      this.running = false;
    }
  }

  /** One retry on transient failure (idempotent deletes/updates). */
  private async runAllWithRetry(): Promise<CleanupStats> {
    try {
      return await this.runAll();
    } catch (err) {
      this.logger.warn(`Cleanup attempt 1 failed, retrying: ${(err as Error)?.message}`);
      await new Promise((r) => setTimeout(r, 2_000));
      return await this.runAll();
    }
  }

  /** Public for tests / manual trigger */
  async runAll(): Promise<CleanupStats> {
    const [otpsDeleted, refreshTokensDeleted, sessionsDeleted, bookingsCompleted, mediaOrphansDeleted] =
      await Promise.all([
        this.purgeExpiredOtps(),
        this.purgeExpiredRefreshTokens(),
        this.purgeExpiredSessions(),
        this.completePastBookings(),
        this.purgeOrphanDraftMedia(),
      ]);
    return {
      otpsDeleted,
      refreshTokensDeleted,
      sessionsDeleted,
      bookingsCompleted,
      mediaOrphansDeleted,
    };
  }

  async purgeExpiredOtps(): Promise<number> {
    const now = new Date();
    const usedRetentionHours = parseInt(process.env.CLEANUP_OTP_USED_HOURS || '24', 10);
    const usedCutoff = new Date(now.getTime() - usedRetentionHours * 3600_000);

    const result = await this.prisma.otpCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { not: null, lt: usedCutoff } },
        ],
      },
    });
    return result.count;
  }

  async purgeExpiredRefreshTokens(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }],
      },
    });
    return result.count;
  }

  async purgeExpiredSessions(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }],
      },
    });
    return result.count;
  }

  /**
   * pending/confirmed with endAt in the past → completed (editable later by pro/admin).
   * Per issue #52: past due bookings auto-marked completed, not expired.
   */
  async completePastBookings(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.booking.updateMany({
      where: {
        status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
        endAt: { lt: now },
      },
      data: {
        status: BookingStatus.completed,
        completedAt: now,
      },
    });
    return result.count;
  }

  /** Draft media older than CLEANUP_MEDIA_DRAFT_HOURS (default 24) — never published uploads. */
  async purgeOrphanDraftMedia(): Promise<number> {
    const hours = parseInt(process.env.CLEANUP_MEDIA_DRAFT_HOURS || '24', 10);
    const cutoff = new Date(Date.now() - hours * 3600_000);

    const orphans = await this.prisma.mediaAsset.findMany({
      where: {
        status: MediaStatus.draft,
        createdAt: { lt: cutoff },
      },
      select: { id: true, storageKey: true },
      take: 200,
    });

    let deleted = 0;
    for (const m of orphans) {
      try {
        if (m.storageKey) {
          try {
            await this.storage.delete(m.storageKey);
          } catch (e) {
            this.logger.warn(`storage delete failed key=${m.storageKey}: ${(e as Error)?.message}`);
          }
        }
        await this.prisma.mediaAsset.delete({ where: { id: m.id } });
        deleted += 1;
      } catch (e) {
        this.logger.warn(`orphan media delete failed id=${m.id}: ${(e as Error)?.message}`);
      }
    }
    return deleted;
  }
}
