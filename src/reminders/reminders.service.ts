import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JobLeaseService } from '../jobs/job-lease.service';

export type ReminderStats = {
  reminders24h: number;
  reminders2h: number;
  reviewRequests: number;
};

/**
 * Periodic jobs for issue #11:
 * - booking_reminder ~24h and ~2h before confirmed appointments
 * - review_request after completed bookings (once, if no review yet)
 *
 * Uses in-app notifications only (SMS out of scope for #11).
 * Dedup: skip if a notification of the same type already exists for that bookingId in data.
 */
@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly jobLease: JobLeaseService,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>('REMINDERS_ENABLED') !== 'false';
    if (!enabled) {
      this.logger.log('Reminders disabled (REMINDERS_ENABLED=false)');
      return;
    }
    const intervalMs = this.resolveIntervalMs();
    // slight delay so app can finish boot
    setTimeout(() => void this.safeRun(), 30_000);
    this.timer = setInterval(() => void this.safeRun(), intervalMs);
    this.logger.log(`Reminders scheduled every ${Math.round(intervalMs / 60_000)} min`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private resolveIntervalMs(): number {
    const min = parseInt(process.env.REMINDERS_INTERVAL_MINUTES || '60', 10);
    if (Number.isNaN(min) || min < 15) return 60 * 60_000;
    return min * 60_000;
  }

  private async safeRun(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // Lease ~15 min — multi-instance safe (#18.2); work itself is idempotent via notification dedup
      const stats = await this.jobLease.withLease('reminders', 15 * 60_000, () =>
        this.runAllWithRetry(),
      );
      if (!stats) return;
      this.logger.log(
        `Reminders done: 24h=${stats.reminders24h} 2h=${stats.reminders2h} review=${stats.reviewRequests}`,
      );
    } catch (err) {
      this.logger.error(`Reminders failed: ${(err as Error)?.message}`);
    } finally {
      this.running = false;
    }
  }

  private async runAllWithRetry(): Promise<ReminderStats> {
    try {
      return await this.runAll();
    } catch (err) {
      this.logger.warn(`Reminders attempt 1 failed, retrying: ${(err as Error)?.message}`);
      await new Promise((r) => setTimeout(r, 2_000));
      return await this.runAll();
    }
  }

  /** Public for tests / manual trigger */
  async runAll(): Promise<ReminderStats> {
    const [reminders24h, reminders2h, reviewRequests] = await Promise.all([
      this.sendWindowReminders('24h', 23, 25),
      this.sendWindowReminders('2h', 1.5, 2.5),
      this.sendReviewRequests(),
    ]);
    return { reminders24h, reminders2h, reviewRequests };
  }

  /**
   * Confirmed bookings whose startAt falls within [now+minHours, now+maxHours].
   * windowKey is stored in data for dedup (24h vs 2h are separate).
   */
  async sendWindowReminders(
    windowKey: '24h' | '2h',
    minHours: number,
    maxHours: number,
  ): Promise<number> {
    const now = Date.now();
    const from = new Date(now + minHours * 3600_000);
    const to = new Date(now + maxHours * 3600_000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.confirmed,
        startAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        customerId: true,
        professionalId: true,
        startAt: true,
        professional: {
          select: { title: true },
        },
      },
      take: 200,
    });

    let sent = 0;
    for (const b of bookings) {
      const already = await this.hasNotification(b.customerId, NotificationType.booking_reminder, {
        bookingId: b.id,
        window: windowKey,
      });
      if (already) continue;

      const proName = b.professional?.title?.trim() || 'زیباگر';
      const when = this.formatTehran(b.startAt);
      const title =
        windowKey === '24h' ? 'یادآوری نوبت (فردا)' : 'یادآوری نوبت (به‌زودی)';
      const body =
        windowKey === '24h'
          ? `نوبت شما با ${proName} حدود ۲۴ ساعت دیگر است (${when}).`
          : `نوبت شما با ${proName} حدود ۲ ساعت دیگر است (${when}).`;

      const result = await this.notifications.notify({
        userId: b.customerId,
        type: NotificationType.booking_reminder,
        title,
        body,
        data: { bookingId: b.id, professionalId: b.professionalId, window: windowKey },
        sms: false,
      });
      if (result?.id) sent += 1;
    }
    return sent;
  }

  /**
   * Completed bookings in the last 48h without a review → one review_request.
   */
  async sendReviewRequests(): Promise<number> {
    const now = Date.now();
    const since = new Date(now - 48 * 3600_000);
    // wait at least 2h after completion before asking
    const until = new Date(now - 2 * 3600_000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.completed,
        completedAt: { gte: since, lte: until },
        review: null,
      },
      select: {
        id: true,
        customerId: true,
        professionalId: true,
        professional: {
          select: { title: true },
        },
      },
      take: 200,
    });

    let sent = 0;
    for (const b of bookings) {
      const already = await this.hasNotification(b.customerId, NotificationType.review_request, {
        bookingId: b.id,
      });
      if (already) continue;

      const proName = b.professional?.title?.trim() || 'زیباگر';
      const result = await this.notifications.notify({
        userId: b.customerId,
        type: NotificationType.review_request,
        title: 'نظر شما مهم است',
        body: `نوبت شما با ${proName} تمام شده. لطفاً نظر خود را ثبت کنید.`,
        data: { bookingId: b.id, professionalId: b.professionalId },
        sms: false,
      });
      if (result?.id) sent += 1;
    }
    return sent;
  }

  /** Dedup: any existing notification of this type for the same bookingId (+ optional window). */
  private async hasNotification(
    userId: string,
    type: NotificationType,
    match: { bookingId: string; window?: string },
  ): Promise<boolean> {
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        type,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) },
      },
      select: { data: true },
      take: 50,
    });
    for (const r of rows) {
      const data = r.data as { bookingId?: string; window?: string } | null;
      if (!data || data.bookingId !== match.bookingId) continue;
      if (match.window && data.window !== match.window) continue;
      return true;
    }
    return false;
  }

  private formatTehran(d: Date): string {
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d);
    } catch {
      return d.toISOString();
    }
  }
}
