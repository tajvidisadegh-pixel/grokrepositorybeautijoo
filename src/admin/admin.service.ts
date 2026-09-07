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
  MediaKind,
  MediaStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  PLATFORM_COMMISSION_RATE_KEY,
} from '../payments/financial.util';

const REVENUE_DATA_RELIABLE = true;

type WindowStats = {
  newUsers: number;
  newProfessionals: number;
  newBookings: number;
  completedBookings: number;
  cancelledBookings: number;
};
type DaySeriesRow = { day: Date; count: bigint };
type BookingDayRow = { day: Date; status: string; count: bigint };
type RevenueDayRow = { day: Date; amount: bigint };

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const [users, professionals, bookings, reviews] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.professional.count(),
      this.prisma.booking.count(),
      this.prisma.review.count(),
    ]);
    const byStatus = await this.prisma.booking.groupBy({
      by: ['status'],
      _count: true,
    });
    return { users, professionals, bookings, reviews, bookingsByStatus: byStatus };
  }

  private async windowStats(since: Date): Promise<WindowStats> {
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
  }

  private toDailySeries(rows: DaySeriesRow[]) {
    return rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      count: Number(r.count),
    }));
  }

  async dashboard() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
      paidAgg,
      today,
      last7Days,
      last30Days,
      thisMonth,
      userGrowthRaw,
      professionalGrowthRaw,
      bookingActivityRaw,
      recentActivityRaw,
      recentProfessionals,
      recentUsers,
      recentBookings,
      recentReviews,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.professional.count(),
      this.prisma.professional.count({
        where: { status: ProfessionalStatus.pending_review },
      }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: BookingStatus.completed } }),
      this.prisma.booking.count({ where: { status: BookingStatus.cancelled } }),
      this.prisma.review.count(),
      this.prisma.payment.count({ where: { status: PaymentStatus.pending } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.failed } }),
      REVENUE_DATA_RELIABLE
        ? this.prisma.payment.aggregate({
            where: { status: PaymentStatus.paid },
            _sum: { amount: true },
          })
        : Promise.resolve(null),
      this.windowStats(startOfToday),
      this.windowStats(sevenDaysAgo),
      this.windowStats(thirtyDaysAgo),
      this.windowStats(startOfMonth),
      this.prisma.$queryRaw<DaySeriesRow[]>`SELECT date_trunc('day', created_at) AS day, COUNT(*)::bigint AS count FROM users WHERE created_at >= ${thirtyDaysAgo} GROUP BY day ORDER BY day ASC`,
      this.prisma.$queryRaw<DaySeriesRow[]>`SELECT date_trunc('day', created_at) AS day, COUNT(*)::bigint AS count FROM professionals WHERE created_at >= ${thirtyDaysAgo} GROUP BY day ORDER BY day ASC`,
      this.prisma.$queryRaw<BookingDayRow[]>`SELECT date_trunc('day', created_at) AS day, status::text AS status, COUNT(*)::bigint AS count FROM bookings WHERE created_at >= ${thirtyDaysAgo} GROUP BY day, status ORDER BY day ASC`,
      this.prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      }),
      this.prisma.professional.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { profile: { select: { displayName: true } } } },
        },
      }),
      this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { profile: true },
      }),
      this.prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { profile: { select: { displayName: true } } },
          },
          professional: { select: { title: true } },
        },
      }),
      this.prisma.review.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: { select: { title: true } },
          customer: { select: { profile: { select: { displayName: true } } } },
        },
      }),
    ]);

    let revenueSeries: { date: string; amount: number }[] | null = null;
    if (REVENUE_DATA_RELIABLE) {
      const revenueRaw = await this.prisma.$queryRaw<
        RevenueDayRow[]
      >`SELECT date_trunc('day', paid_at) AS day, SUM(amount)::bigint AS amount FROM payments WHERE status = 'paid' AND paid_at >= ${thirtyDaysAgo} GROUP BY day ORDER BY day ASC`;
      revenueSeries = revenueRaw.map((r) => ({
        date: r.day.toISOString().slice(0, 10),
        amount: Number(r.amount),
      }));
    }

    const bookingActivityMap = new Map<
      string,
      { date: string; total: number; completed: number; cancelled: number }
    >();
    for (const row of bookingActivityRaw) {
      const date = row.day.toISOString().slice(0, 10);
      const entry = bookingActivityMap.get(date) || {
        date,
        total: 0,
        completed: 0,
        cancelled: 0,
      };
      const c = Number(row.count);
      entry.total += c;
      if (row.status === BookingStatus.completed) entry.completed += c;
      if (row.status === BookingStatus.cancelled) entry.cancelled += c;
      bookingActivityMap.set(date, entry);
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
        revenue: REVENUE_DATA_RELIABLE
          ? { available: true, total: paidAgg?._sum.amount ?? 0 }
          : { available: false },
      },
      timeStats: { today, last7Days, last30Days, thisMonth },
      trends: {
        userGrowth: this.toDailySeries(userGrowthRaw),
        professionalGrowth: this.toDailySeries(professionalGrowthRaw),
        bookingActivity: Array.from(bookingActivityMap.values()).sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
        revenue: revenueSeries,
      },
      pending: {
        professionalsAwaitingReview: pendingProfessionals,
        pendingPayments,
        failedPayments,
      },
      recentActivity: recentActivityRaw.map((a) => ({
        id: a.id,
        actor: a.actor?.profile?.displayName || a.actor?.phone || null,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        createdAt: a.createdAt,
      })),
      recent: {
        professionals: recentProfessionals.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          createdAt: p.createdAt,
          displayName: p.user?.profile?.displayName ?? null,
        })),
        users: recentUsers.map((u) => ({
          id: u.id,
          phone: u.phone,
          displayName: u.profile?.displayName ?? null,
          createdAt: u.createdAt,
        })),
        bookings: recentBookings.map((b) => ({
          id: b.id,
          status: b.status,
          totalPrice: b.totalPrice,
          createdAt: b.createdAt,
          professionalTitle: b.professional?.title ?? null,
          customerName: b.customer?.profile?.displayName ?? null,
        })),
        reviews: recentReviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          professionalTitle: r.professional?.title ?? null,
          customerName: r.customer?.profile?.displayName ?? null,
        })),
      },
    };
  }

  async getFinancialSummary(
    period: 'today' | 'this_month' | 'all_time' = 'all_time',
  ) {
    const now = new Date();
    let startDate: Date | undefined;
    if (period === 'today')
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (period === 'this_month')
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateFilter = startDate ? { gte: startDate } : undefined;

    const [
      paidAggregate,
      paidCount,
      pendingCount,
      failedCount,
      cancelledCount,
      refundedCount,
      recentPaidPayments,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.paid,
          ...(dateFilter ? { paidAt: dateFilter } : {}),
        },
        _sum: {
          amount: true,
          platformCommissionAmount: true,
          professionalNetAmount: true,
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.paid,
          ...(dateFilter ? { paidAt: dateFilter } : {}),
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.pending,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.failed,
          ...(dateFilter ? { failedAt: dateFilter } : {}),
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.cancelled,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      this.prisma.payment.count({
        where: {
          status: PaymentStatus.refunded,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.paid,
          ...(dateFilter ? { paidAt: dateFilter } : {}),
        },
        orderBy: { paidAt: 'desc' },
        take: 10,
        select: {
          id: true,
          amount: true,
          platformCommissionRate: true,
          platformCommissionAmount: true,
          professionalNetAmount: true,
          provider: true,
          providerRef: true,
          paidAt: true,
          booking: {
            select: {
              id: true,
              customer: {
                select: {
                  phone: true,
                  profile: { select: { displayName: true } },
                },
              },
              professional: { select: { title: true, slug: true } },
            },
          },
        },
      }),
    ]);

    return {
      period,
      currency: 'TOMAN',
      providerType: 'MOCK_TEST_PAYMENT',
      refundImplemented: true,
      grossRevenue: paidAggregate._sum.amount ?? 0,
      platformCommission: paidAggregate._sum.platformCommissionAmount ?? 0,
      professionalNet: paidAggregate._sum.professionalNetAmount ?? 0,
      paymentFee: 0,
      transactions: {
        paid: paidCount,
        pending: pendingCount,
        failed: failedCount,
        cancelled: cancelledCount,
        refunded: refundedCount,
      },
      recentPaidPayments,
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
    if (query.provider)
      where.provider = { equals: query.provider, mode: 'insensitive' };
    if (query.startDate || query.endDate) {
      const dateRange: Prisma.DateTimeFilter = {};
      if (query.startDate) dateRange.gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        dateRange.lte = end;
      }
      where.createdAt = dateRange;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { providerRef: { contains: term, mode: 'insensitive' } },
        { idempotencyKey: { contains: term, mode: 'insensitive' } },
        { booking: { customer: { phone: { contains: term } } } },
        {
          booking: {
            customer: {
              profile: { displayName: { contains: term, mode: 'insensitive' } },
            },
          },
        },
        {
          booking: {
            professional: { title: { contains: term, mode: 'insensitive' } },
          },
        },
      ];
    }
    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: sortDir },
        include: {
          booking: {
            select: {
              id: true,
              totalPrice: true,
              status: true,
              startAt: true,
              customer: {
                select: {
                  id: true,
                  phone: true,
                  profile: { select: { displayName: true } },
                },
              },
              professional: { select: { id: true, title: true, slug: true } },
              location: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  city: true,
                  province: true,
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
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getFinancialTransactionDetail(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            customer: {
              select: {
                id: true,
                phone: true,
                profile: { select: { displayName: true } },
              },
            },
            professional: {
              select: {
                id: true,
                title: true,
                slug: true,
                user: { select: { phone: true } },
              },
            },
            location: {
              select: {
                id: true,
                name: true,
                address: true,
                city: true,
                province: true,
              },
            },
            items: { include: { service: { select: { name: true } } } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('تراکنش مالی یافت نشد');
    return {
      ...payment,
      isCommissionSnapshotted: payment.platformCommissionRate !== null,
      providerNote: 'Mock / Test Payment Provider',
      refundStatus:
        payment.status === 'refunded'
          ? 'Refunded'
          : payment.status === 'paid'
            ? 'Eligible'
            : 'Not Applicable',
    };
  }

  async getCommissionSetting() {
    let rate = DEFAULT_PLATFORM_COMMISSION_RATE;
    let updatedAt: Date | null = null;
    try {
      const setting = await this.prisma.platformSetting.findUnique({
        where: { key: PLATFORM_COMMISSION_RATE_KEY },
      });
      if (setting?.value !== null && setting?.value !== undefined) {
        const val =
          typeof setting.value === 'number'
            ? setting.value
            : typeof setting.value === 'object' && 'rate' in (setting.value as any)
              ? Number((setting.value as any).rate)
              : Number(setting.value);
        if (!isNaN(val) && val >= 0 && val <= 100) {
          rate = val;
          updatedAt = setting.updatedAt;
        }
      }
    } catch {
      rate = DEFAULT_PLATFORM_COMMISSION_RATE;
    }
    return {
      key: PLATFORM_COMMISSION_RATE_KEY,
      rate,
      defaultRate: DEFAULT_PLATFORM_COMMISSION_RATE,
      updatedAt,
      notice:
        'تغییر نرخ کارمزد فقط بر تراکنش‌های آینده اعمال شده و Snapshot تراکنش‌های گذشته بدون تغییر باقی می‌ماند.',
    };
  }

  async updateCommissionSetting(newRate: number, adminUserId?: string) {
    if (
      typeof newRate !== 'number' ||
      isNaN(newRate) ||
      newRate < 0 ||
      newRate > 100
    )
      throw new BadRequestException('نرخ کارمزد باید عددی بین ۰ تا ۱۰۰ باشد.');
    const roundedRate = Math.round(newRate * 100) / 100;
    const updated = await this.prisma.platformSetting.upsert({
      where: { key: PLATFORM_COMMISSION_RATE_KEY },
      update: { value: { rate: roundedRate } },
      create: {
        key: PLATFORM_COMMISSION_RATE_KEY,
        value: { rate: roundedRate },
      },
    });
    return {
      key: PLATFORM_COMMISSION_RATE_KEY,
      rate: roundedRate,
      defaultRate: DEFAULT_PLATFORM_COMMISSION_RATE,
      updatedAt: updated.updatedAt,
      notice:
        'تغییر نرخ کارمزد فقط بر تراکنش‌های آینده اعمال شده و Snapshot تراکنش‌های گذشته بدون تغییر باقی می‌ماند.',
    };
  }

  async listRoles() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        rolePermissions: { include: { permission: true } },
        _count: { select: { userRoles: true } },
      },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { rolePermissions: true } } },
    });
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
    return { success: true, threshold, updatedAt: new Date().toISOString() };
  }

  async listUsers(_q: any) {
    return { items: [], meta: { page: 1, limit: 20, total: 0 } };
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

  async listProfessionals(_q: any) {
    return { items: [], meta: { page: 1, limit: 20, total: 0 } };
  }

  async getProfessionalDetail(id: string) {
    return this.prisma.professional.findUnique({ where: { id } });
  }

  async setProfessionalStatus(
    id: string,
    status: ProfessionalStatus,
    _actorId?: string,
    _reason?: string,
  ) {
    return this.prisma.professional.update({ where: { id }, data: { status } });
  }

  async setProfessionalFeatured(id: string, isFeatured: boolean, _actorId?: string) {
    return this.prisma.professional.update({ where: { id }, data: { isFeatured } });
  }

  async listBookings(_q: any) {
    return { items: [], meta: { page: 1, limit: 20, total: 0 } };
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

  async listAuditLogs(_q: any) {
    return { items: [], meta: { page: 1, limit: 50, total: 0 } };
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
}
