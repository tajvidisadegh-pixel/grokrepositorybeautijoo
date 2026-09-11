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
import { userAuthCache } from '../auth/user-auth-cache';

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

function withPublicUrl<T extends { url?: string | null }>(row: T): T & { publicUrl: string | null } {
  const url = row?.url ?? null;
  return { ...row, publicUrl: url };
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

  private async audit(
    actorId: string | undefined,
    action: string,
    entityType: string,
    entityId: string | null,
    before?: unknown,
    after?: unknown,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId ?? null,
          action,
          entityType,
          entityId,
          before: before === undefined ? undefined : (before as Prisma.InputJsonValue),
          after: after === undefined ? undefined : (after as Prisma.InputJsonValue),
        },
      });
    } catch {
      /* non-blocking */
    }
  }

  async stats() {
    const [users, professionals, bookings, reviews, completed, cancelled, pending] =
      await Promise.all([
        this.safeCount(() => this.prisma.user.count()),
        this.safeCount(() => this.prisma.professional.count()),
        this.safeCount(() => this.prisma.booking.count()),
        this.safeCount(() => this.prisma.review.count()),
        this.safeCount(() =>
          this.prisma.booking.count({ where: { status: BookingStatus.completed } }),
        ),
        this.safeCount(() =>
          this.prisma.booking.count({ where: { status: BookingStatus.cancelled } }),
        ),
        this.safeCount(() =>
          this.prisma.booking.count({ where: { status: BookingStatus.pending } }),
        ),
      ]);
    return {
      users,
      professionals,
      bookings,
      reviews,
      bookingsByStatus: [
        { status: 'completed', _count: completed },
        { status: 'cancelled', _count: cancelled },
        { status: 'pending', _count: pending },
      ],
    };
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

    let recentProfessionals: {
      id: string;
      title: string;
      status: string;
      displayName: string | null;
      createdAt: string;
    }[] = [];
    let recentUsers: {
      id: string;
      phone: string | null;
      displayName: string | null;
      createdAt: string;
    }[] = [];
    let recentBookings: {
      id: string;
      status: string;
      professionalTitle: string | null;
      customerName: string | null;
      createdAt: string;
    }[] = [];
    let recentReviews: {
      id: string;
      rating: number;
      professionalTitle: string | null;
      createdAt: string;
    }[] = [];

    try {
      const rows = await this.prisma.professional.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { include: { profile: true } } },
      });
      recentProfessionals = rows.map((p) => ({
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
      const rows = await this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { profile: true },
      });
      recentUsers = rows.map((u) => ({
        id: u.id,
        phone: u.phone,
        displayName: u.profile?.displayName ?? null,
        createdAt: u.createdAt.toISOString(),
      }));
    } catch {
      recentUsers = [];
    }

    try {
      const rows = await this.prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: true,
          customer: { include: { profile: true } },
        },
      });
      recentBookings = rows.map((b) => ({
        id: b.id,
        status: b.status,
        professionalTitle: b.professional?.title ?? null,
        customerName:
          b.customer?.profile?.displayName ?? b.customer?.phone ?? null,
        createdAt: b.createdAt.toISOString(),
      }));
    } catch {
      recentBookings = [];
    }

    try {
      const rows = await this.prisma.review.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { professional: true },
      });
      recentReviews = rows.map((r) => ({
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
        revenue: null as null,
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

  // ---- Financial ----
  async getFinancialSummary(period: 'today' | 'this_month' | 'all_time' = 'all_time') {
    let since: Date | undefined;
    if (period === 'today') since = startOfTodayUtc();
    if (period === 'this_month') since = startOfMonthUtc();

    const whereBase: Prisma.PaymentWhereInput = since
      ? { createdAt: { gte: since } }
      : {};

    const [paidAgg, pending, failed, cancelled, refunded, recentPaid] =
      await Promise.all([
        this.prisma.payment.aggregate({
          where: { ...whereBase, status: PaymentStatus.paid },
          _sum: {
            amount: true,
            platformCommissionAmount: true,
            professionalNetAmount: true,
          },
          _count: true,
        }),
        this.prisma.payment.count({
          where: { ...whereBase, status: PaymentStatus.pending },
        }),
        this.prisma.payment.count({
          where: { ...whereBase, status: PaymentStatus.failed },
        }),
        this.prisma.payment.count({
          where: { ...whereBase, status: PaymentStatus.cancelled },
        }),
        this.prisma.payment.count({
          where: { ...whereBase, status: PaymentStatus.refunded },
        }),
        this.prisma.payment.findMany({
          where: { status: PaymentStatus.paid },
          orderBy: { paidAt: 'desc' },
          take: 10,
          include: {
            booking: {
              select: {
                id: true,
                professionalId: true,
                customerId: true,
              },
            },
          },
        }),
      ]);

    const gross = paidAgg._sum.amount ?? 0;
    const commission = paidAgg._sum.platformCommissionAmount ?? 0;
    const net = paidAgg._sum.professionalNetAmount ?? Math.max(0, gross - commission);

    return {
      period,
      currency: 'TOMAN',
      providerType: process.env.PAYMENT_PROVIDER || 'none',
      refundImplemented: true,
      grossRevenue: gross,
      platformCommission: commission,
      professionalNet: net,
      paymentFee: 0,
      transactions: {
        paid: paidAgg._count ?? 0,
        pending,
        failed,
        cancelled,
        refunded,
      },
      recentPaidPayments: recentPaid,
    };
  }

  async listFinancialTransactions(query: {
    page?: number;
    limit?: number;
    status?: PaymentStatus;
    provider?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: 'createdAt' | 'paidAt' | 'amount';
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.PaymentWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.provider) where.provider = query.provider;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { providerRef: { contains: term, mode: 'insensitive' } },
        { idempotencyKey: { contains: term, mode: 'insensitive' } },
        { bookingId: { equals: term } },
      ];
    }
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          booking: {
            select: {
              id: true,
              status: true,
              professional: { select: { id: true, title: true } },
              customer: {
                select: {
                  id: true,
                  phone: true,
                  profile: { select: { displayName: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async getFinancialTransactionDetail(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            professional: true,
            customer: { include: { profile: true } },
            items: true,
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Transaction not found');
    return payment;
  }

  async getCommissionSetting() {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: PLATFORM_COMMISSION_RATE_KEY },
    });
    const rate =
      typeof row?.value === 'number'
        ? row.value
        : typeof row?.value === 'object' &&
            row?.value &&
            'rate' in (row.value as object)
          ? Number((row.value as { rate: number }).rate)
          : DEFAULT_PLATFORM_COMMISSION_RATE;
    return {
      key: PLATFORM_COMMISSION_RATE_KEY,
      rate: Number.isFinite(rate) ? rate : DEFAULT_PLATFORM_COMMISSION_RATE,
      defaultRate: DEFAULT_PLATFORM_COMMISSION_RATE,
      updatedAt: row?.updatedAt?.toISOString?.() ?? null,
      notice: '',
    };
  }

  async updateCommissionSetting(newRate: number, adminUserId?: string) {
    if (typeof newRate !== 'number' || isNaN(newRate) || newRate < 0 || newRate > 100) {
      throw new BadRequestException('Commission rate must be between 0 and 100');
    }
    const rate = Math.round(newRate * 100) / 100;
    const before = await this.getCommissionSetting();
    const row = await this.prisma.platformSetting.upsert({
      where: { key: PLATFORM_COMMISSION_RATE_KEY },
      create: { key: PLATFORM_COMMISSION_RATE_KEY, value: { rate } },
      update: { value: { rate } },
    });
    await this.audit(
      adminUserId,
      'settings.commission_update',
      'platform_setting',
      row.id,
      { rate: before.rate },
      { rate },
    );
    return {
      key: PLATFORM_COMMISSION_RATE_KEY,
      rate,
      defaultRate: DEFAULT_PLATFORM_COMMISSION_RATE,
      updatedAt: row.updatedAt.toISOString(),
      notice: '',
    };
  }

  async getFailedTransactionsAlert() {
    const thresholdSetting = await this.prisma.platformSetting.findUnique({
      where: { key: 'failed_payment_alert_threshold' },
    });
    const threshold =
      typeof thresholdSetting?.value === 'number'
        ? thresholdSetting.value
        : typeof thresholdSetting?.value === 'object' &&
            thresholdSetting?.value &&
            'threshold' in (thresholdSetting.value as object)
          ? Number((thresholdSetting.value as { threshold: number }).threshold)
          : 3;
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recentFailed = await this.prisma.payment.findMany({
      where: { status: PaymentStatus.failed, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      isTriggered: recentFailed.length >= threshold,
      failedCount: recentFailed.length,
      threshold,
      timeWindowMinutes: 60,
      since: since.toISOString(),
      recentFailed,
    };
  }

  async updateFailedTransactionsThreshold(threshold: number, adminUserId?: string) {
    if (!Number.isFinite(threshold) || threshold < 1 || threshold > 1000) {
      throw new BadRequestException('threshold must be between 1 and 1000');
    }
    const row = await this.prisma.platformSetting.upsert({
      where: { key: 'failed_payment_alert_threshold' },
      create: { key: 'failed_payment_alert_threshold', value: { threshold } },
      update: { value: { threshold } },
    });
    await this.audit(
      adminUserId,
      'settings.failed_threshold_update',
      'platform_setting',
      row.id,
      null,
      { threshold },
    );
    return { threshold };
  }

  // ---- Users ----
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
    if (q.role) {
      where.userRoles = { some: { role: { name: q.role } } };
    }
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
      items: items.map((u) => ({
        ...u,
        roles: u.userRoles.map((ur) => ur.role.name),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      ...user,
      roles: user.userRoles.map((ur) => ur.role.name),
    };
  }

  async setUserStatus(id: string, status: UserStatus, actorId?: string, reason?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({ where: { id }, data: { status } });
    userAuthCache.invalidate(id);
    await this.audit(actorId, 'user.status_change', 'user', id, { status: existing.status }, { status, reason });
    return updated;
  }

  async setUserRoles(id: string, roles: string[], actorId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const uniqueNames = Array.from(
      new Set((roles || []).map((r) => String(r).trim()).filter(Boolean)),
    );
    if (uniqueNames.length === 0) {
      throw new BadRequestException('حداقل یک نقش لازم است');
    }

    const dbRoles = await this.prisma.role.findMany({
      where: { name: { in: uniqueNames } },
    });
    if (dbRoles.length !== uniqueNames.length) {
      const found = new Set(dbRoles.map((r) => r.name));
      const missing = uniqueNames.filter((n) => !found.has(n));
      throw new BadRequestException(`نقش‌های نامعتبر: ${missing.join(', ')}`);
    }

    const before = await this.prisma.userRole.findMany({
      where: { userId: id },
      include: { role: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: dbRoles.map((r) => ({
          userId: id,
          roleId: r.id,
          assignedBy: actorId ?? null,
        })),
      });
    });

    userAuthCache.invalidate(id);

    await this.audit(
      actorId,
      'user.roles_change',
      'user',
      id,
      { roles: before.map((b) => b.role.name) },
      { roles: uniqueNames },
    );

    return this.getUserDetail(id);
  }

  // ---- Professionals ----
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
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
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
        mediaAssets: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!pro) throw new NotFoundException('Professional not found');
    return {
      ...pro,
      mediaAssets: (pro.mediaAssets || []).map(withPublicUrl),
    };
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

    await this.audit(
      actorId,
      'professional.status_change',
      'professional',
      id,
      { status: existing.status, publishedAt: existing.publishedAt },
      { status, reason: reason ?? null },
    );

    return updated;
  }

  async setProfessionalFeatured(id: string, isFeatured: boolean, actorId?: string) {
    const updated = await this.prisma.professional.update({
      where: { id },
      data: { isFeatured },
    });
    await this.audit(actorId, 'professional.feature', 'professional', id, null, { isFeatured });
    return updated;
  }

  // ---- Bookings ----
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
    if (q.startDate || q.endDate) {
      where.startAt = {};
      if (q.startDate) where.startAt.gte = new Date(q.startDate);
      if (q.endDate) where.startAt.lte = new Date(q.endDate);
    }
    if (q.search?.trim()) {
      const term = q.search.trim();
      where.OR = [
        { id: { equals: term } },
        { customer: { phone: { contains: term } } },
        { professional: { title: { contains: term, mode: 'insensitive' } } },
      ];
    }
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
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async getBookingDetail(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        professional: true,
        customer: { include: { profile: true } },
        items: true,
        payment: true,
        review: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async updateBookingStatus(
    id: string,
    status: BookingStatus,
    actorId?: string,
    reason?: string,
  ) {
    const existing = await this.prisma.booking.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Booking not found');
    const data: Prisma.BookingUpdateInput = { status };
    if (status === BookingStatus.confirmed) data.confirmedAt = new Date();
    if (status === BookingStatus.cancelled) {
      data.cancelledAt = new Date();
      data.cancelReason = reason ?? existing.cancelReason;
    }
    if (status === BookingStatus.completed) data.completedAt = new Date();
    if (status === BookingStatus.rejected) data.rejectedReason = reason ?? existing.rejectedReason;
    const updated = await this.prisma.booking.update({ where: { id }, data });
    await this.audit(actorId, 'booking.status_change', 'booking', id, { status: existing.status }, { status, reason });
    return updated;
  }

  // ---- Reviews ----
  async listReviews(q: {
    page?: number;
    limit?: number;
    search?: string;
    rating?: number;
    isPublished?: boolean;
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.ReviewWhereInput = {};
    if (typeof q.isPublished === 'boolean') where.isPublished = q.isPublished;
    if (typeof q.rating === 'number' && !Number.isNaN(q.rating)) where.rating = q.rating;
    if (q.search?.trim()) {
      const term = q.search.trim();
      where.OR = [
        { comment: { contains: term, mode: 'insensitive' } },
        { professional: { title: { contains: term, mode: 'insensitive' } } },
        { customer: { phone: { contains: term } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: { select: { id: true, title: true, slug: true } },
          customer: {
            select: {
              id: true,
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async setReviewVisibility(
    id: string,
    isPublished: boolean,
    actorId?: string,
    reason?: string,
  ) {
    const updated = await this.prisma.review.update({
      where: { id },
      data: { isPublished },
    });
    await this.audit(actorId, 'review.visibility', 'review', id, null, { isPublished, reason });
    return updated;
  }

  async deleteReview(id: string, actorId?: string) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Review not found');
    await this.prisma.review.delete({ where: { id } });
    await this.audit(actorId, 'review.delete', 'review', id, existing, null);
    return { id, deleted: true };
  }

  // ---- Media ----
  async listMedia(q: {
    page?: number;
    limit?: number;
    search?: string;
    kind?: string;
    status?: MediaStatus;
    professionalId?: string;
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 24));
    const skip = (page - 1) * limit;
    const where: Prisma.MediaAssetWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.kind) where.kind = q.kind as never;
    if (q.professionalId) where.professionalId = q.professionalId;
    if (q.search?.trim()) {
      const term = q.search.trim();
      where.OR = [
        { url: { contains: term, mode: 'insensitive' } },
        { storageKey: { contains: term, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: { select: { id: true, title: true, slug: true } },
        },
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return {
      items: items.map(withPublicUrl),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async setMediaStatus(id: string, status: MediaStatus, actorId?: string) {
    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: { status },
    });
    await this.audit(actorId, 'media.status', 'media_asset', id, null, { status });
    return withPublicUrl(updated);
  }

  async deleteMedia(id: string, actorId?: string) {
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Media not found');
    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.audit(actorId, 'media.delete', 'media_asset', id, existing, null);
    return { id, deleted: true };
  }

  // ---- Audit ----
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
    const where: Prisma.AuditLogWhereInput = {};
    if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
    if (q.actorId) where.actorId = q.actorId;
    if (q.entityType) where.entityType = q.entityType;
    if (q.entityId) where.entityId = q.entityId;
    if (q.startDate || q.endDate) {
      where.createdAt = {};
      if (q.startDate) where.createdAt.gte = new Date(q.startDate);
      if (q.endDate) where.createdAt.lte = new Date(q.endDate);
    }
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  // ---- Notifications ----
  async listNotifications(q: {
    page?: number;
    limit?: number;
    type?: NotificationType;
    search?: string;
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 30));
    const skip = (page - 1) * limit;
    const where: Prisma.NotificationWhereInput = {};
    if (q.type) where.type = q.type;
    if (q.search?.trim()) {
      const term = q.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { body: { contains: term, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async broadcastNotification(
    dto: { title: string; body: string; target: 'all' | 'professionals' | 'customers' },
    actorId?: string,
  ) {
    if (!dto?.title?.trim() || !dto?.body?.trim()) {
      throw new BadRequestException('title and body are required');
    }
    const where: Prisma.UserWhereInput = { status: UserStatus.active };
    if (dto.target === 'professionals') {
      where.userRoles = { some: { role: { name: 'professional' } } };
    } else if (dto.target === 'customers') {
      where.userRoles = { some: { role: { name: 'customer' } } };
    }
    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
      take: 5000,
    });
    if (users.length === 0) {
      return { success: true, created: 0 };
    }
    const result = await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: NotificationType.system,
        title: dto.title.trim(),
        body: dto.body.trim(),
        data: { broadcast: true, target: dto.target, actorId: actorId ?? null },
      })),
    });
    await this.audit(actorId, 'notification.broadcast', 'notification', null, null, {
      target: dto.target,
      created: result.count,
    });
    return { success: true, created: result.count };
  }

  // ---- Settings / CMS / Site builder (PlatformSetting JSON store) ----
  async getPlatformSettings() {
    const rows = await this.prisma.platformSetting.findMany();
    const out: Record<string, unknown> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  async updatePlatformSettingsGroup(
    group: string,
    values: Record<string, unknown>,
    actorId?: string,
  ) {
    const key = `settings.${group}`;
    const row = await this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: values as Prisma.InputJsonValue },
      update: { value: values as Prisma.InputJsonValue },
    });
    await this.audit(actorId, 'settings.group_update', 'platform_setting', row.id, null, {
      group,
      values,
    });
    return { key, value: row.value };
  }

  async getCMSContent() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'cms.content' } });
    return (row?.value as Record<string, unknown>) || {};
  }

  async updateCMSContent(content: Record<string, unknown>, actorId?: string) {
    const row = await this.prisma.platformSetting.upsert({
      where: { key: 'cms.content' },
      create: { key: 'cms.content', value: content as Prisma.InputJsonValue },
      update: { value: content as Prisma.InputJsonValue },
    });
    await this.audit(actorId, 'cms.update', 'platform_setting', row.id, null, content);
    return row.value;
  }

  async getSiteBuilder() {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: 'site.builder' },
    });
    const val = row?.value;
    return Array.isArray(val) ? val : [];
  }

  async updateSiteBuilder(sections: unknown[], actorId?: string) {
    const row = await this.prisma.platformSetting.upsert({
      where: { key: 'site.builder' },
      create: { key: 'site.builder', value: sections as Prisma.InputJsonValue },
      update: { value: sections as Prisma.InputJsonValue },
    });
    await this.audit(actorId, 'site_builder.update', 'platform_setting', row.id, null, {
      count: Array.isArray(sections) ? sections.length : 0,
    });
    return Array.isArray(row.value) ? row.value : [];
  }

  async listRoles() {
    return this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }
}
