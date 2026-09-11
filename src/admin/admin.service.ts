import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProfessionalStatus,
  BookingStatus,
  PaymentStatus,
  UserStatus,
  MediaStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  PLATFORM_COMMISSION_RATE_KEY,
} from '../payments/financial.util';

type WindowStats = {
  newUsers: number;
  newProfessionals: number;
  newBookings: number;
  completedBookings: number;
  cancelledBookings: number;
};

function emptyWindow(): WindowStats {
  return {
    newUsers: 0,
    newProfessionals: 0,
    newBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
  };
}

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonthUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function daysAgoUtc(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private async safeCount(fn: () => Promise<number>): Promise<number> {
    try {
      return await fn();
    } catch {
      return 0;
    }
  }

  async stats() {
    const [users, professionals, bookings, reviews] = await Promise.all([
      this.safeCount(() => this.prisma.user.count()),
      this.safeCount(() => this.prisma.professional.count()),
      this.safeCount(() => this.prisma.booking.count()),
      this.safeCount(() => this.prisma.review.count()),
    ]);
    let bookingsByStatus: { status: string; _count: number }[] = [];
    try {
      bookingsByStatus = await this.prisma.booking.groupBy({
        by: ['status'],
        _count: true,
      });
    } catch {
      bookingsByStatus = [];
    }
    return { users, professionals, bookings, reviews, bookingsByStatus };
  }

  private async windowStats(since: Date): Promise<WindowStats> {
    try {
      const [
        newUsers,
        newProfessionals,
        newBookings,
        completedBookings,
        cancelledBookings,
      ] = await Promise.all([
        this.prisma.user.count({ where: { createdAt: { gte: since } } }),
        this.prisma.professional.count({ where: { createdAt: { gte: since } } }),
        this.prisma.booking.count({ where: { createdAt: { gte: since } } }),
        this.prisma.booking.count({
          where: { createdAt: { gte: since }, status: BookingStatus.completed },
        }),
        this.prisma.booking.count({
          where: { createdAt: { gte: since }, status: BookingStatus.cancelled },
        }),
      ]);
      return {
        newUsers,
        newProfessionals,
        newBookings,
        completedBookings,
        cancelledBookings,
      };
    } catch {
      return emptyWindow();
    }
  }

  /** Full shape required by frontend AdminDashboard */
  async dashboard() {
    const today = startOfTodayUtc();
    const last7 = daysAgoUtc(7);
    const last30 = daysAgoUtc(30);
    const thisMonth = startOfMonthUtc();

    const [
      totalUsers,
      totalProfessionals,
      pendingProfessionals,
      totalBookings,
      completedBookings,
      cancelledBookings,
      totalReviews,
      pendingPayments,
      failedPayments,
      paidRevenue,
      timeToday,
      time7,
      time30,
      timeMonth,
    ] = await Promise.all([
      this.safeCount(() => this.prisma.user.count()),
      this.safeCount(() => this.prisma.professional.count()),
      this.safeCount(() =>
        this.prisma.professional.count({
          where: { status: ProfessionalStatus.pending_review },
        }),
      ),
      this.safeCount(() => this.prisma.booking.count()),
      this.safeCount(() =>
        this.prisma.booking.count({ where: { status: BookingStatus.completed } }),
      ),
      this.safeCount(() =>
        this.prisma.booking.count({ where: { status: BookingStatus.cancelled } }),
      ),
      this.safeCount(() => this.prisma.review.count()),
      this.safeCount(() =>
        this.prisma.payment.count({ where: { status: PaymentStatus.pending } }),
      ),
      this.safeCount(() =>
        this.prisma.payment.count({ where: { status: PaymentStatus.failed } }),
      ),
      (async () => {
        try {
          const agg = await this.prisma.payment.aggregate({
            where: { status: PaymentStatus.paid },
            _sum: { amount: true },
          });
          return agg._sum.amount ?? 0;
        } catch {
          return 0;
        }
      })(),
      this.windowStats(today),
      this.windowStats(last7),
      this.windowStats(last30),
      this.windowStats(thisMonth),
    ]);

    // Simple day-bucket trends (last 30 days) without raw SQL
    const userGrowth: { date: string; count: number }[] = [];
    const professionalGrowth: { date: string; count: number }[] = [];
    const bookingActivity: {
      date: string;
      total: number;
      completed: number;
      cancelled: number;
    }[] = [];

    try {
      const since = last30;
      const [users, pros, bookings] = await Promise.all([
        this.prisma.user.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
        this.prisma.professional.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
        this.prisma.booking.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true, status: true },
        }),
      ]);

      const dayKey = (d: Date) => d.toISOString().slice(0, 10);
      const uMap = new Map<string, number>();
      const pMap = new Map<string, number>();
      const bMap = new Map<
        string,
        { total: number; completed: number; cancelled: number }
      >();

      for (let i = 0; i < 30; i++) {
        const d = daysAgoUtc(29 - i);
        const k = dayKey(d);
        uMap.set(k, 0);
        pMap.set(k, 0);
        bMap.set(k, { total: 0, completed: 0, cancelled: 0 });
      }

      for (const u of users) {
        const k = dayKey(u.createdAt);
        if (uMap.has(k)) uMap.set(k, (uMap.get(k) || 0) + 1);
      }
      for (const p of pros) {
        const k = dayKey(p.createdAt);
        if (pMap.has(k)) pMap.set(k, (pMap.get(k) || 0) + 1);
      }
      for (const b of bookings) {
        const k = dayKey(b.createdAt);
        const row = bMap.get(k);
        if (!row) continue;
        row.total += 1;
        if (b.status === BookingStatus.completed) row.completed += 1;
        if (b.status === BookingStatus.cancelled) row.cancelled += 1;
      }

      for (const [date, count] of uMap) userGrowth.push({ date, count });
      for (const [date, count] of pMap) professionalGrowth.push({ date, count });
      for (const [date, v] of bMap) bookingActivity.push({ date, ...v });
    } catch {
      /* empty trends */
    }

    let recentActivity: {
      id: string;
      action: string;
      entityType: string;
      actor: string | null;
      createdAt: string;
    }[] = [];
    try {
      const logs = await this.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { include: { profile: true } },
        } as any,
      });
      recentActivity = (logs as any[]).map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        actor: l.actor?.profile?.displayName || l.actor?.phone || null,
        createdAt: l.createdAt?.toISOString?.() || String(l.createdAt),
      }));
    } catch {
      try {
        const logs = await this.prisma.auditLog.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
        });
        recentActivity = logs.map((l) => ({
          id: l.id,
          action: l.action,
          entityType: l.entityType,
          actor: null,
          createdAt: l.createdAt.toISOString(),
        }));
      } catch {
        recentActivity = [];
      }
    }

    let recentProfessionals: any[] = [];
    let recentUsers: any[] = [];
    let recentBookings: any[] = [];
    let recentReviews: any[] = [];

    try {
      recentProfessionals = await this.prisma.professional.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { include: { profile: true } },
        },
      });
      recentProfessionals = recentProfessionals.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        displayName: p.user?.profile?.displayName ?? null,
        createdAt: p.createdAt.toISOString(),
      }));
    } catch {
      recentProfessionals = [];
    }

    try {
      const users = await this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { profile: true },
      });
      recentUsers = users.map((u) => ({
        id: u.id,
        phone: u.phone,
        displayName: u.profile?.displayName ?? null,
        createdAt: u.createdAt.toISOString(),
      }));
    } catch {
      recentUsers = [];
    }

    try {
      const bookings = await this.prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: true,
          customer: { include: { profile: true } },
        },
      });
      recentBookings = bookings.map((b) => ({
        id: b.id,
        status: b.status,
        professionalTitle: b.professional?.title ?? null,
        customerName: b.customer?.profile?.displayName ?? b.customer?.phone ?? null,
        createdAt: b.createdAt.toISOString(),
      }));
    } catch {
      recentBookings = [];
    }

    try {
      const reviews = await this.prisma.review.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { professional: true },
      });
      recentReviews = reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        professionalTitle: r.professional?.title ?? null,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch {
      recentReviews = [];
    }

    return {
      overview: {
        totalUsers,
        totalProfessionals,
        pendingProfessionals,
        totalBookings,
        completedBookings,
        cancelledBookings,
        totalReviews,
        revenue: { available: true, total: paidRevenue },
      },
      timeStats: {
        today: timeToday,
        last7Days: time7,
        last30Days: time30,
        thisMonth: timeMonth,
      },
      trends: {
        userGrowth,
        professionalGrowth,
        bookingActivity,
        revenue: null,
      },
      pending: {
        professionalsAwaitingReview: pendingProfessionals,
        pendingPayments,
        failedPayments,
      },
      recentActivity,
      recent: {
        professionals: recentProfessionals,
        users: recentUsers,
        bookings: recentBookings,
        reviews: recentReviews,
      },
    };
  }

  async getFinancialSummary(_period: 'today' | 'this_month' | 'all_time' = 'all_time') {
    return {
      period: _period,
      currency: 'TOMAN',
      providerType: 'test',
      refundImplemented: false,
      grossRevenue: 0,
      platformCommission: 0,
      professionalNet: 0,
      paymentFee: 0,
      transactions: {
        paid: 0,
        pending: 0,
        failed: 0,
        cancelled: 0,
        refunded: 0,
      },
      recentPaidPayments: [],
    };
  }

  async listFinancialTransactions(_query: any) {
    return { items: [], meta: { page: 1, limit: 20, total: 0 } };
  }

  async getFinancialTransactionDetail(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Transaction not found');
    return payment;
  }

  async getCommissionSetting() {
    return {
      key: PLATFORM_COMMISSION_RATE_KEY,
      rate: DEFAULT_PLATFORM_COMMISSION_RATE,
      defaultRate: DEFAULT_PLATFORM_COMMISSION_RATE,
      updatedAt: null,
      notice: '',
    };
  }

  async updateCommissionSetting(newRate: number, _adminUserId?: string) {
    if (typeof newRate !== 'number' || isNaN(newRate) || newRate < 0 || newRate > 100) {
      throw new BadRequestException('Commission rate must be between 0 and 100');
    }
    return {
      key: PLATFORM_COMMISSION_RATE_KEY,
      rate: Math.round(newRate * 100) / 100,
      defaultRate: DEFAULT_PLATFORM_COMMISSION_RATE,
      updatedAt: new Date().toISOString(),
      notice: '',
    };
  }

  async getFailedTransactionsAlert() {
    return {
      isTriggered: false,
      failedCount: 0,
      threshold: 3,
      timeWindowMinutes: 60,
      since: new Date().toISOString(),
      recentFailed: [],
    };
  }

  async updateFailedTransactionsThreshold(threshold: number, _adminUserId?: string) {
    return { threshold };
  }

  async listUsers(q: {
    page?: number;
    limit?: number;
    search?: string;
    status?: UserStatus;
    role?: string;
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.search?.trim()) {
      const term = q.search.trim();
      where.OR = [
        { phone: { contains: term } },
        { email: { contains: term, mode: 'insensitive' } },
        { profile: { displayName: { contains: term, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { profile: true, userRoles: { include: { role: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserDetail(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
  }

  async setUserStatus(id: string, status: UserStatus, _actorId?: string, _reason?: string) {
    return this.prisma.user.update({ where: { id }, data: { status } });
  }

  async setUserRoles(id: string, roles: string[], _actorId?: string) {
    return { id, roles };
  }

  async listProfessionals(q: {
    page?: number;
    limit?: number;
    search?: string;
    status?: ProfessionalStatus;
    isFeatured?: boolean;
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.ProfessionalWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.isFeatured !== undefined) where.isFeatured = q.isFeatured;
    if (q.search?.trim()) {
      const term = q.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
        { user: { phone: { contains: term } } },
        {
          user: {
            profile: { displayName: { contains: term, mode: 'insensitive' } },
          },
        },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          user: {
            select: {
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      }),
      this.prisma.professional.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getProfessionalDetail(id: string) {
    const pro = await this.prisma.professional.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            phone: true,
            profile: true,
            userRoles: { include: { role: true } },
          },
        },
        locations: { include: { location: true } },
        professionalServices: {
          include: { service: { include: { category: true } } },
        },
        workingHours: { include: { breaks: true } },
      },
    });
    if (!pro) throw new NotFoundException('Professional not found');
    return pro;
  }

  async setProfessionalStatus(
    id: string,
    status: ProfessionalStatus,
    actorId?: string,
    reason?: string,
  ) {
    const existing = await this.prisma.professional.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Professional not found');

    const data: Prisma.ProfessionalUpdateInput = { status };
    if (status === ProfessionalStatus.approved) {
      data.publishedAt = existing.publishedAt ?? new Date();
      data.verifiedAt = existing.verifiedAt ?? new Date();
    } else if (
      status === ProfessionalStatus.rejected ||
      status === ProfessionalStatus.draft
    ) {
      data.publishedAt = null;
    }

    const updated = await this.prisma.professional.update({
      where: { id },
      data,
    });

    try {
      let title = 'Profile status updated';
      let body = 'Your professional profile status changed: ' + String(status);
      if (status === ProfessionalStatus.approved) {
        title = 'Profile approved';
        body = 'Your professional profile was approved and is now public.';
      } else if (status === ProfessionalStatus.rejected) {
        title = 'Profile rejected';
        body = reason
          ? 'Your profile was rejected. Reason: ' + reason
          : 'Your profile was rejected. Please update and resubmit.';
      } else if (status === ProfessionalStatus.pending_review) {
        title = 'Pending review';
        body = 'Your profile is queued for admin review.';
      } else if (status === ProfessionalStatus.suspended) {
        title = 'Profile suspended';
        body = reason
          ? 'Your profile was suspended. Reason: ' + reason
          : 'Your profile was temporarily suspended.';
      }
      await this.prisma.notification.create({
        data: {
          userId: existing.userId,
          type: NotificationType.system,
          title,
          body,
          data: { professionalId: id, status, reason: reason ?? null },
        },
      });
    } catch {
      /* non-blocking */
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId ?? null,
          action: 'professional.status_change',
          entityType: 'professional',
          entityId: id,
          before: { status: existing.status, publishedAt: existing.publishedAt },
          after: { status, reason: reason ?? null },
        },
      });
    } catch {
      /* non-blocking */
    }

    return updated;
  }

  async setProfessionalFeatured(id: string, isFeatured: boolean, _actorId?: string) {
    return this.prisma.professional.update({ where: { id }, data: { isFeatured } });
  }

  async listBookings(q: {
    page?: number;
    limit?: number;
    search?: string;
    status?: BookingStatus;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.BookingWhereInput = {};
    if (q.status) where.status = q.status;
    try {
      const [items, total] = await Promise.all([
        this.prisma.booking.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            professional: true,
            customer: { include: { profile: true } },
          },
        }),
        this.prisma.booking.count({ where }),
      ]);
      return {
        items,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch {
      return { items: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }
  }

  async getBookingDetail(id: string) {
    return this.prisma.booking.findUnique({ where: { id } });
  }

  async updateBookingStatus(
    id: string,
    status: BookingStatus,
    _actorId?: string,
    _reason?: string,
  ) {
    return this.prisma.booking.update({ where: { id }, data: { status } });
  }

  async listReviews(_q: any) {
    return { items: [], meta: { page: 1, limit: 20, total: 0 } };
  }

  async setReviewVisibility(
    id: string,
    isPublished: boolean,
    _actorId?: string,
    _reason?: string,
  ) {
    return this.prisma.review.update({ where: { id }, data: { isPublished } });
  }

  async deleteReview(id: string, _actorId?: string) {
    return this.prisma.review.delete({ where: { id } });
  }

  async listMedia(_q: any) {
    return { items: [], meta: { page: 1, limit: 24, total: 0 } };
  }

  async setMediaStatus(id: string, status: MediaStatus, _actorId?: string) {
    return this.prisma.mediaAsset.update({ where: { id }, data: { status } });
  }

  async deleteMedia(id: string, _actorId?: string) {
    return this.prisma.mediaAsset.delete({ where: { id } });
  }

  async listAuditLogs(q: {
    page?: number;
    limit?: number;
    action?: string;
    actorId?: string;
    entityType?: string;
    entityId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 50));
    const skip = (page - 1) * limit;
    try {
      const [items, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.auditLog.count(),
      ]);
      return {
        items,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch {
      return { items: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }
  }

  async listNotifications(_q: any) {
    return { items: [], meta: { page: 1, limit: 30, total: 0 } };
  }

  async broadcastNotification(_dto: any, _actorId?: string) {
    return { success: true };
  }

  async getPlatformSettings() {
    return {};
  }

  async updatePlatformSettingsGroup(_group: string, _values: any, _actorId?: string) {
    return {};
  }

  async getCMSContent() {
    return {};
  }

  async updateCMSContent(_content: any, _actorId?: string) {
    return {};
  }

  async getSiteBuilder() {
    return [];
  }

  async updateSiteBuilder(_sections: any[], _actorId?: string) {
    return [];
  }

  async listRoles() {
    return this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany();
  }
}
