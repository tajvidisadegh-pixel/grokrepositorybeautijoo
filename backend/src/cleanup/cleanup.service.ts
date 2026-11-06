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
  unpaidPendingExpired: number;
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
      const stats = await this.jobLease.withLease('cleanup', 10 * 60_000, () =>
        this.runAllWithRetry(),
      );
      if (!stats) return;
      this.logger.log(
        `Cleanup done: otp=${stats.otpsDeleted} refresh=${stats.refreshTokensDeleted} ` +
          `sessions=${stats.sessionsDeleted} bookingsCompleted=${stats.bookingsCompleted} ` +
          `unpaidExpired=${stats.unpaidPendingExpired} mediaOrphans=${stats.mediaOrphansDeleted}`,
      );
    } catch (err) {
      this.logger.error(`Cleanup failed: ${(err as Error)?.message}`);
    } finally {
      this.running = false;
    }
  }

  private async runAllWithRetry(): Promise<CleanupStats> {
    try {
      return await this.runAll();
    } catch (err) {
      this.logger.warn(`Cleanup attempt 1 failed, retrying: ${(err as Error)?.message}`);
      await new Promise((r) => setTimeout(r, 2_000));
      return await this.runAll();
    }
  }

  async runAll(): Promise<CleanupStats> {
    const [
      otpsDeleted,
      refreshTokensDeleted,
      sessionsDeleted,
      bookingsCompleted,
      unpaidPendingExpired,
      mediaOrphansDeleted,
    ] = await Promise.all([
      this.purgeExpiredOtps(),
      this.purgeExpiredRefreshTokens(),
      this.purgeExpiredSessions(),
      this.completePastBookings(),
      this.expireUnpaidPendingBookings(),
      this.purgeOrphanDraftMedia(),
    ]);
    return {
      otpsDeleted,
      refreshTokensDeleted,
      sessionsDeleted,
      bookingsCompleted,
      unpaidPendingExpired,
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

  /** #64.2 — Unpaid pending must not lock calendar forever (default 30m). */
  async expireUnpaidPendingBookings(): Promise<number> {
    const minutes = Math.max(
      5,
      parseInt(process.env.PENDING_PAYMENT_TTL_MINUTES || '30', 10) || 30,
    );
    const cutoff = new Date(Date.now() - minutes * 60_000);
    const candidates = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.pending,
        createdAt: { lt: cutoff },
        OR: [
          { payment: null },
          { payment: { status: { in: ['pending', 'processing', 'failed', 'cancelled'] } } },
        ],
      },
      select: { id: true },
      take: 200,
    });
    if (!candidates.length) return 0;
    const result = await this.prisma.booking.updateMany({
      where: {
        id: { in: candidates.map((c) => c.id) },
        status: BookingStatus.pending,
      },
      data: {
        status: BookingStatus.expired,
        cancelReason: 'unpaid_pending_ttl',
        cancelledAt: new Date(),
      },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} unpaid pending booking(s) older than ${minutes}m`);
    }
    return result.count;
  }

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
