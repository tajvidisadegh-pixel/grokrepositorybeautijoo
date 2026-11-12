import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import {
  ProfessionalStatus,
  BookingStatus,
  PaymentStatus,
  PayoutStatus,
  UserStatus,
  MediaStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import * as fs from 'fs';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage.provider';
import { AppCacheService } from '../cache/app-cache.service';
import { userAuthCache } from '../auth/user-auth-cache';
import { assertNotSuspicious, assertUploadSize } from '../media/upload-security';
import { sniffImage } from '../media/image-sniff';

/** Whitelist root keys for platform_config (#r4.H2). */
const ALLOWED_PLATFORM_ROOT_KEYS = new Set([
  'booking', 'commission', 'professionals', 'reviews', 'search', 'auth', 'privacy',
]);

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly cache: AppCacheService,
    private readonly authService: AuthService,
  ) {}

  private maskPhone(phone?: string | null): string | null {
    if (!phone) return null;
    const p = String(phone);
    if (p.length < 7) return '***';
    return p.slice(0, 4) + '***' + p.slice(-2);
  }

  private async audit(
    actorId: string | undefined,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action,
          entityType,
          entityId,
          before: before as any,
          after: after as any,
        },
      });
    } catch {
      /* non-blocking */
    }
  }

  async stats() {
    const [users, professionals, bookings, reviews, byStatus] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.professional.count(),
      this.prisma.booking.count(),
      this.prisma.review.count(),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);
    const bookingsByStatus = byStatus.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));
    return { users, professionals, bookings, reviews, bookingsByStatus };
  }

  async dashboard() {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const last1h = new Date(now.getTime() - 60 * 60 * 1000);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const windowStats = async (since: Date) => {
      const [newUsers, newProfessionals, newBookings, completedBookings, cancelledBookings] =
        await Promise.all([
          this.prisma.user.count({ where: { createdAt: { gte: since } } }),
          this.prisma.professional.count({ where: { createdAt: { gte: since } } }),
          this.prisma.booking.count({ where: { createdAt: { gte: since } } }),
          this.prisma.booking.count({
            where: { status: BookingStatus.completed, createdAt: { gte: since } },
          }),
          this.prisma.booking.count({
            where: { status: BookingStatus.cancelled, createdAt: { gte: since } },
          }),
        ]);
      return { newUsers, newProfessionals, newBookings, completedBookings, cancelledBookings };
    };

    const [
      totalUsers,
      totalProfessionals,
      pendingProfessionals,
      totalBookings,
      completedBookings,
      cancelledBookings,
      totalReviews,
      paidAgg,
      pendingPayments,
      failedPayments,
      today,
      last1Hour,
      last24Hours,
      last7Days,
      last30Days,
      thisMonth,
      recentUsers,
      recentProfessionals,
      recentBookings,
      recentReviews,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.professional.count(),
      this.prisma.professional.count({ where: { status: ProfessionalStatus.pending_review } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: BookingStatus.completed } }),
      this.prisma.booking.count({ where: { status: BookingStatus.cancelled } }),
      this.prisma.review.count(),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.paid },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({ where: { status: PaymentStatus.pending } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.failed } }),
      windowStats(startOfToday),
      windowStats(last1h),
      windowStats(last24h),
      windowStats(last7),
      windowStats(last30),
      windowStats(startOfMonth),
      this.prisma.user.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          phone: true,
          createdAt: true,
          profile: { select: { displayName: true } },
        },
      }),
      this.prisma.professional.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, status: true },
      }),
      this.prisma.booking.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          professional: { select: { title: true } },
          customer: { select: { profile: { select: { displayName: true } } } },
        },
      }),
      this.prisma.review.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          rating: true,
          professional: { select: { title: true } },
        },
      }),
    ]);
    const grossRevenue = Number(paidAgg._sum.amount || 0);
    return {
      overview: {
        totalUsers,
        totalProfessionals,
        pendingProfessionals,
        totalBookings,
        completedBookings,
        cancelledBookings,
        totalReviews,
        revenue: { available: true, total: grossRevenue },
      },
      timeStats: {
        today,
        last1Hour,
        last24Hours,
        last7Days,
        last30Days,
        thisMonth,
      },
      trends: {
        userGrowth: [],
        professionalGrowth: [],
        bookingActivity: [],
        revenue: null,
      },
      pending: {
        professionalsAwaitingReview: pendingProfessionals,
        pendingPayments,
        failedPayments,
      },
      recentActivity: [],
      recent: {
        users: recentUsers.map((u) => ({
          id: u.id,
          phone: this.maskPhone(u.phone),
          displayName: u.profile?.displayName ?? null,
          createdAt: u.createdAt,
        })),
        professionals: recentProfessionals.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
        })),
        bookings: recentBookings.map((b) => ({
          id: b.id,
          status: b.status,
          professionalTitle: b.professional?.title ?? null,
          customerName: b.customer?.profile?.displayName ?? null,
        })),
        reviews: recentReviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          professionalTitle: r.professional?.title ?? null,
        })),
      },
    };
  }

  async getFinancialSummary(_period?: string) {
    const period = _period || 'all_time';
    const now = new Date();
    let createdAt: Prisma.DateTimeFilter | undefined;
    if (period === 'today') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      createdAt = { gte: start };
    } else if (period === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      createdAt = { gte: start };
    }
    const baseWhere: Prisma.PaymentWhereInput = createdAt ? { createdAt } : {};
    const [paidAgg, commissionAgg, paidCount, failedCount, pendingCount] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { ...baseWhere, status: PaymentStatus.paid },
        _sum: { amount: true, platformCommissionAmount: true, professionalNetAmount: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { ...baseWhere, status: PaymentStatus.paid },
        _sum: { platformCommissionAmount: true, professionalNetAmount: true },
      }),
      this.prisma.payment.count({ where: { ...baseWhere, status: PaymentStatus.paid } }),
      this.prisma.payment.count({ where: { ...baseWhere, status: PaymentStatus.failed } }),
      this.prisma.payment.count({ where: { ...baseWhere, status: PaymentStatus.pending } }),
    ]);
    const grossRevenue = Number(paidAgg._sum.amount || 0);
    let platformCommission = Number(commissionAgg._sum.platformCommissionAmount || 0);
    let professionalNet = Number(commissionAgg._sum.professionalNetAmount || 0);
    let commissionEstimated = false;
    if (!platformCommission && grossRevenue) {
      const rate = (await this.getCommissionSetting()).rate;
      platformCommission = Math.round(grossRevenue * (rate / 100));
      professionalNet = Math.max(0, grossRevenue - platformCommission);
      commissionEstimated = true; // #r4.H7 — historical rows missing snapshot
    }
    return {
      period,
      grossRevenue,
      platformCommission,
      professionalNet,
      commissionEstimated,
      transactions: {
        paid: paidCount,
        failed: failedCount,
        pending: pendingCount,
      },
    };
  }

  async listFinancialTransactions(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.PaymentWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.provider) where.provider = String(q.provider);
    if (q.search?.trim()) {
      const s = String(q.search).trim();
      where.OR = [
        { providerRef: { contains: s, mode: 'insensitive' } },
        { booking: { customer: { phone: { contains: s } } } },
        { booking: { customer: { profile: { displayName: { contains: s, mode: 'insensitive' } } } } },
        { booking: { professional: { title: { contains: s, mode: 'insensitive' } } } },
      ];
    }
    if (q.startDate || q.endDate) {
      where.createdAt = {};
      if (q.startDate) where.createdAt.gte = new Date(q.startDate);
      if (q.endDate) where.createdAt.lte = new Date(q.endDate);
    }
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            select: {
              id: true,
              customer: { select: { phone: true, profile: { select: { displayName: true } } } },
              professional: { select: { title: true } },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async getFinancialTransactionDetail(id: string) {
    const row = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            startAt: true,
            totalPrice: true,
            customer: { select: { id: true, phone: true, profile: { select: { displayName: true } } } },
            professional: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Transaction not found');
    return row;
  }

  async getCommissionSetting() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'commission_rate' } });
    const rate = row && typeof (row.value as any)?.rate === 'number' ? Number((row.value as any).rate) : 10;
    return { rate, notice: null };
  }

  async updateCommissionSetting(newRate: number, adminUserId?: string) {
    const rate = Math.min(100, Math.max(0, Number(newRate)));
    const value = { rate } as any;
    await this.prisma.platformSetting.upsert({
      where: { key: 'commission_rate' },
      create: { key: 'commission_rate', value },
      update: { value },
    });
    await this.audit(adminUserId, 'finance.commission_update', 'platform_setting', 'commission_rate', null, value);
    return { rate, notice: 'نرخ کارمزد ذخیره شد' };
  }

  async getFailedTransactionsAlert() {
    const thresholdRow = await this.prisma.platformSetting.findUnique({ where: { key: 'failed_alert_threshold' } });
    const threshold = thresholdRow && typeof (thresholdRow.value as any)?.threshold === 'number'
      ? Number((thresholdRow.value as any).threshold)
      : 5;
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const failedCount = await this.prisma.payment.count({
      where: { status: PaymentStatus.failed, createdAt: { gte: since } },
    });
    const recent = await this.prisma.payment.findMany({
      where: { status: PaymentStatus.failed },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        booking: {
          select: {
            customer: { select: { profile: { select: { displayName: true } }, phone: true } },
            professional: { select: { title: true } },
          },
        },
      },
    });
    return {
      failedCount,
      threshold,
      isTriggered: failedCount >= threshold,
      recentFailed: recent.map((r) => ({
        id: r.id,
        amount: r.amount,
        failedAt: r.failedAt || r.createdAt,
        customerName: r.booking?.customer?.profile?.displayName || r.booking?.customer?.phone || '—',
        professionalTitle: r.booking?.professional?.title || null,
      })),
    };
  }

  async setFailedTransactionsThreshold(threshold: number, actorId?: string) {
    const t = Math.max(0, Math.floor(Number(threshold) || 0));
    const value = { threshold: t } as any;
    await this.prisma.platformSetting.upsert({
      where: { key: 'failed_alert_threshold' },
      create: { key: 'failed_alert_threshold', value },
      update: { value },
    });
    await this.audit(actorId, 'finance.failed_threshold', 'platform_setting', 'failed_alert_threshold', null, value);
    return this.getFailedTransactionsAlert();
  }

  async listUsers(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.UserWhereInput = { professional: { is: null } };
    if (q.status) where.status = q.status;
    if (q.search?.trim()) {
      const s = String(q.search).trim();
      where.OR = [
        { phone: { contains: s } },
        { profile: { displayName: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { profile: true, userRoles: { include: { role: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    const masked = items.map((u) => ({
      ...u,
      phone: this.maskPhone(u.phone),
    }));
    return { items: masked, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async getCustomersStats() {
    const base = { professional: { is: null } } as Prisma.UserWhereInput;
    const [total, active, suspended, inactive, withBookings] = await Promise.all([
      this.prisma.user.count({ where: base }),
      this.prisma.user.count({ where: { ...base, status: UserStatus.active } }),
      this.prisma.user.count({ where: { ...base, status: UserStatus.suspended } }),
      this.prisma.user.count({ where: { ...base, status: UserStatus.inactive } }),
      this.prisma.user.count({ where: { ...base, bookingsAsCustomer: { some: {} } } }),
    ]);
    return { total, active, suspended, inactive, withBookings, neverBooked: Math.max(0, total - withBookings) };
  }

  async getUserDetail(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
    if (!u) throw new NotFoundException('User not found');
    const roles = u.userRoles.map((ur) => ur.role.name);
    return { ...u, roles };
  }

  async setUserStatus(id: string, status: UserStatus | string, actorId?: string, reason?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
    if (!existing) throw new NotFoundException('User not found');
    if (actorId && actorId === id && status !== UserStatus.active) {
      throw new BadRequestException('نمی‌توانید وضعیت حساب خودتان را غیرفعال کنید');
    }
    const targetIsSuper = (existing.userRoles || []).some((ur) => ur.role.name === 'SUPER_ADMIN');
    if (targetIsSuper && status !== UserStatus.active) {
      const superCount = await this.prisma.userRole.count({
        where: { role: { name: 'SUPER_ADMIN' }, user: { status: UserStatus.active } },
      });
      if (superCount <= 1) {
        throw new BadRequestException('نمی‌توان آخرین SUPER_ADMIN فعال را غیرفعال کرد');
      }
    }
    const updated = await this.prisma.user.update({ where: { id }, data: { status: status as UserStatus } });
    await this.audit(actorId, 'user.status_change', 'user', id, { status: existing.status }, { status, reason });
    // #82.15 — drop in-memory JWT user cache so suspended/inactive takes effect immediately on this instance
    userAuthCache.invalidate(id);
    return updated;
  }

  async setUserRoles(id: string, roles: string[], actorId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
    if (!existing) throw new NotFoundException('User not found');

    const normalized = Array.from(
      new Set(
        (roles || [])
          .map((r) => String(r || '').trim())
          .filter(Boolean),
      ),
    );
    if (!normalized.length) {
      throw new BadRequestException('حداقل یک نقش باید مشخص شود');
    }

    // Issue #37: only SUPER_ADMIN may grant SUPER_ADMIN; admin is fully separate
    if (normalized.some((r) => r.toLowerCase() === 'super_admin')) {
      if (actorId) {
        const actor = await this.prisma.user.findUnique({
          where: { id: actorId },
          include: { userRoles: { include: { role: true } } },
        });
        const actorRoles = actor?.userRoles.map((ur) => ur.role.name) || [];
        if (!actorRoles.includes('SUPER_ADMIN')) {
          throw new ForbiddenException('فقط سوپر ادمین می‌تواند نقش SUPER_ADMIN را اختصاص دهد');
        }
      } else {
        throw new ForbiddenException('فقط سوپر ادمین می‌تواند نقش SUPER_ADMIN را اختصاص دهد');
      }
    }

    // #r4.C2 — non-SUPER_ADMIN may only assign roles they themselves hold
    if (actorId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        include: { userRoles: { include: { role: true } } },
      });
      const actorRoles = (actor?.userRoles || []).map((ur) => ur.role.name);
      const isSuper = actorRoles.includes('SUPER_ADMIN');
      if (!isSuper) {
        const actorLower = new Set(actorRoles.map((r) => r.toLowerCase()));
        const forbidden = normalized.filter((r) => !actorLower.has(r.toLowerCase()));
        if (forbidden.length) {
          throw new ForbiddenException(`نمی‌توانید نقش‌هایی که خودتان ندارید اعطا کنید: ${forbidden.join(', ')}`);
        }
      }
    }

    const roleRows = await this.prisma.role.findMany({
      where: {
        OR: [
          { name: { in: normalized, mode: 'insensitive' } },
          { displayName: { in: normalized, mode: 'insensitive' } },
        ],
      },
    });
    if (roleRows.length !== normalized.length) {
      const found = new Set(
        roleRows.flatMap((r) => [r.name.toLowerCase(), r.displayName.toLowerCase()]),
      );
      const missing = normalized.filter((n) => !found.has(n.toLowerCase()));
      throw new BadRequestException(`نقش‌های نامعتبر: ${missing.join(', ')}`);
    }

    const beforeRoles = existing.userRoles.map((ur) => ur.role.name);
    // #r4.H5 — cannot remove last active SUPER_ADMIN
    if (beforeRoles.includes('SUPER_ADMIN') && !normalized.some((r) => r.toLowerCase() === 'super_admin')) {
      const superCount = await this.prisma.userRole.count({
        where: { role: { name: 'SUPER_ADMIN' }, user: { status: UserStatus.active } },
      });
      if (superCount <= 1) {
        throw new BadRequestException('نمی‌توان نقش آخرین SUPER_ADMIN فعال را برداشت');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: roleRows.map((r) => ({
          userId: id,
          roleId: r.id,
          assignedBy: actorId || null,
        })),
      });
      // #82.15 — bump updatedAt so other instances drop JWT auth cache
      await tx.user.update({ where: { id }, data: { updatedAt: new Date() } });
    });

    const updated = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, userRoles: { include: { role: true } } },
    });

    await this.audit(
      actorId,
      'user.roles_change',
      'user',
      id,
      { roles: beforeRoles },
      { roles: roleRows.map((r) => r.name) },
    );

    userAuthCache.invalidate(id);
    return updated;
  }

  async listProfessionals(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.ProfessionalWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.isFeatured !== undefined) where.isFeatured = !!q.isFeatured;
    if (q.search?.trim()) {
      const s = String(q.search).trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { slug: { contains: s, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { include: { profile: true } } },
      }),
      this.prisma.professional.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async getProfessionalsReviewQueue() {
    const [pending, rejected, draft] = await Promise.all([
      this.prisma.professional.count({ where: { status: ProfessionalStatus.pending_review } }),
      this.prisma.professional.count({ where: { status: ProfessionalStatus.rejected } }),
      this.prisma.professional.count({ where: { status: ProfessionalStatus.draft } }),
    ]);
    const items = await this.prisma.professional.findMany({
      where: { status: { in: [ProfessionalStatus.pending_review, ProfessionalStatus.draft] } },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: { user: { include: { profile: true } } },
    });
    return {
      counts: { pendingReview: pending, rejected, draft },
      items,
    };
  }

  async updateProfessional(
    id: string,
    data: {
      title?: string;
      bio?: string;
      isFeatured?: boolean;
      selectedCategoryIds?: string[];
    },
    actorId?: string,
  ) {
    const existing = await this.prisma.professional.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Professional not found');
    const updated = await this.prisma.professional.update({
      where: { id },
      data: {
        title: data.title,
        bio: data.bio,
        isFeatured: data.isFeatured,
        selectedCategoryIds:
          data.selectedCategoryIds !== undefined
            ? (data.selectedCategoryIds as unknown as Prisma.InputJsonValue)
            : undefined,
      },
    });
    await this.audit(actorId, 'professional.update', 'professional', id, existing, data);
    return updated;
  }

  async getProfessionalDetail(id: string) {
    const p = await this.prisma.professional.findUnique({
      where: { id },
      include: {
        user: { include: { profile: true } },
        professionalServices: {
          include: {
            service: { include: { category: true } },
          },
        },
        locations: {
          include: { location: true },
          orderBy: { isPrimary: 'desc' },
        },
        mediaAssets: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] },
        bookings: {
          take: 20,
          orderBy: { startAt: 'desc' },
          include: {
            customer: { include: { profile: true } },
            payment: true,
          },
        },
        reviews: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { include: { profile: true } },
          },
        },
      },
    });
    if (!p) throw new NotFoundException('Professional not found');

    const primaryCity =
      p.locations?.find((l) => l.isPrimary)?.location?.city ||
      p.locations?.[0]?.location?.city ||
      null;

    const [bookingTotal, bookingCompleted, bookingCancelled, bookingPending, mediaCount, serviceCount] =
      await Promise.all([
        this.prisma.booking.count({ where: { professionalId: id } }),
        this.prisma.booking.count({ where: { professionalId: id, status: BookingStatus.completed } }),
        this.prisma.booking.count({ where: { professionalId: id, status: BookingStatus.cancelled } }),
        this.prisma.booking.count({ where: { professionalId: id, status: BookingStatus.pending } }),
        this.prisma.mediaAsset.count({ where: { professionalId: id } }),
        this.prisma.professionalService.count({ where: { professionalId: id, isActive: true } }),
      ]);

    const revenueAgg = await this.prisma.payment.aggregate({
      where: { status: PaymentStatus.paid, booking: { professionalId: id } },
      _sum: { professionalNetAmount: true, amount: true },
    });

    return {
      ...p,
      city: primaryCity,
      mediaAssets: (p.mediaAssets || []).map((m) => ({
        ...m,
        publicUrl: m.url,
      })),
      stats: {
        total: bookingTotal,
        successful: bookingCompleted,
        cancelled: bookingCancelled,
        pending: bookingPending,
        revenue: Number(revenueAgg._sum.professionalNetAmount || revenueAgg._sum.amount || 0),
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        reviewCount: p.reviews?.length ?? 0,
        serviceCount,
        mediaCount,
      },
    };
  }

  async setProfessionalStatus(id: string, status: ProfessionalStatus, actorId?: string, reason?: string) {
    const existing = await this.prisma.professional.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Professional not found');

    const data: Prisma.ProfessionalUpdateInput = { status };

    // Public catalog requires status=approved AND publishedAt != null
    if (status === ProfessionalStatus.approved) {
      const [svcCount, locCount] = await Promise.all([
        this.prisma.professionalService.count({ where: { professionalId: id, isActive: true } }),
        this.prisma.professionalLocation.count({ where: { professionalId: id } }),
      ]);
      if (svcCount < 1) {
        throw new BadRequestException('برای تأیید، حداقل یک خدمت فعال لازم است');
      }
      if (locCount < 1) {
        throw new BadRequestException('برای تأیید، ثبت آدرس لازم است');
      }
      data.publishedAt = existing.publishedAt || new Date();
      data.verifiedAt = existing.verifiedAt || new Date();
    } else if (
      status === ProfessionalStatus.rejected ||
      status === ProfessionalStatus.suspended ||
      status === ProfessionalStatus.draft
    ) {
      data.publishedAt = null;
    }

    if (status === ProfessionalStatus.rejected && reason && String(reason).trim()) {
      const links = { ...((existing.socialLinks as Record<string, unknown>) || {}) };
      links._rejectionReason = String(reason).trim().slice(0, 500);
      data.socialLinks = links as object;
    } else if (status === ProfessionalStatus.approved) {
      const links = { ...((existing.socialLinks as Record<string, unknown>) || {}) };
      if ('_rejectionReason' in links) {
        delete links._rejectionReason;
        data.socialLinks = (Object.keys(links).length ? links : null) as object;
      }
    }

    const updated = await this.prisma.professional.update({ where: { id }, data });
    this.cache.invalidateCatalog();

    // Media stays draft until explicitly moderated (#r4.H4)

    // In-app notification for the professional
    try {
      let title = 'به‌روزرسانی وضعیت پروفایل';
      let body = `وضعیت پروفایل شما به «${status}» تغییر کرد.`;
      if (status === ProfessionalStatus.approved) {
        title = 'پروفایل شما تأیید شد';
        body =
          'تبریک! پروفایل زیباگری شما توسط مدیریت تأیید و منتشر شد. از این پس در نتایج جستجو نمایش داده می‌شوید.';
      } else if (status === ProfessionalStatus.rejected) {
        title = 'پروفایل شما رد شد';
        body =
          (reason && String(reason).trim()) ||
          'پروفایل شما توسط مدیریت رد شد. لطفاً اطلاعات را تکمیل و دوباره ارسال کنید.';
      } else if (status === ProfessionalStatus.suspended) {
        title = 'پروفایل شما تعلیق شد';
        body =
          (reason && String(reason).trim()) ||
          'پروفایل شما موقتاً تعلیق شده است. برای جزئیات با پشتیبانی تماس بگیرید.';
      }
      await this.prisma.notification.create({
        data: {
          userId: existing.userId,
          type: NotificationType.system,
          title,
          body,
          data: { professionalId: id, status, reason: reason || null } as any,
        },
      });
    } catch (e) {
      this.logger.warn(`notify professional status failed: ${(e as Error)?.message || e}`);
    }

    await this.audit(
      actorId,
      'professional.status_change',
      'professional',
      id,
      { status: existing.status, publishedAt: existing.publishedAt },
      { status, publishedAt: updated.publishedAt, reason },
    );
    return updated;
  }

  async setProfessionalFeatured(id: string, isFeatured: boolean, actorId?: string) {
    const updated = await this.prisma.professional.update({ where: { id }, data: { isFeatured } });
    await this.audit(actorId, 'professional.featured', 'professional', id, null, { isFeatured });
    return updated;
  }

  async getBookingsStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [total, today, pending, completed, cancelled, paidAgg, failedPayments] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { startAt: { gte: todayStart } } }),
      this.prisma.booking.count({ where: { status: BookingStatus.pending } }),
      this.prisma.booking.count({ where: { status: BookingStatus.completed } }),
      this.prisma.booking.count({ where: { status: BookingStatus.cancelled } }),
      this.prisma.payment.aggregate({ where: { status: PaymentStatus.paid }, _sum: { amount: true } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.failed } }),
    ]);
    const grossRevenue = Number(paidAgg._sum.amount || 0);
    const commissionRate = (await this.getCommissionSetting()).rate;
    return {
      total,
      today,
      pending,
      completed,
      cancelled,
      grossRevenue,
      platformShare: Math.round(grossRevenue * (commissionRate / 100)),
      commissionRate,
      failedPayments,
    };
  }

  async listBookings(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.BookingWhereInput = {};
    if (q.status) {
      if (!Object.values(BookingStatus).includes(q.status)) {
        throw new BadRequestException('status نامعتبر');
      }
      where.status = q.status;
    }
    if (q.paymentStatus) {
      if (!Object.values(PaymentStatus).includes(q.paymentStatus)) {
        throw new BadRequestException('paymentStatus نامعتبر');
      }
      where.payment = { status: q.paymentStatus };
    }
    if (q.startDate || q.endDate) {
      where.startAt = {};
      if (q.startDate) (where.startAt as any).gte = new Date(q.startDate);
      if (q.endDate) {
        const end = new Date(q.endDate);
        end.setHours(23, 59, 59, 999);
        (where.startAt as any).lte = end;
      }
    }
    if (q.search?.trim()) {
      const s = String(q.search).trim();
      where.OR = [
        { customer: { phone: { contains: s } } },
        { customer: { profile: { displayName: { contains: s, mode: 'insensitive' } } } },
        { professional: { title: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startAt: 'desc' },
        include: {
          customer: { include: { profile: true } },
          professional: { include: { user: { include: { profile: true } } } },
          payment: true,
          items: { include: { service: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async getBookingDetail(id: string) {
    const b = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        customer: { include: { profile: true } },
        professional: { include: { user: { include: { profile: true } } } },
        payment: true,
        items: { include: { service: true } },
      },
    });
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }

  async updateBookingStatus(id: string, status: BookingStatus, actorId?: string, reason?: string) {
    const existing = await this.prisma.booking.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!existing) throw new NotFoundException('Booking not found');

    const from = existing.status;
    const allowed: Record<string, BookingStatus[]> = {
      [BookingStatus.pending]: [BookingStatus.confirmed, BookingStatus.rejected, BookingStatus.cancelled, BookingStatus.expired],
      [BookingStatus.confirmed]: [BookingStatus.completed, BookingStatus.cancelled, BookingStatus.no_show],
      [BookingStatus.rejected]: [],
      [BookingStatus.cancelled]: [],
      [BookingStatus.completed]: [],
      [BookingStatus.expired]: [],
      [BookingStatus.no_show]: [],
    };
    const nextOk = (allowed[from] || []).includes(status);
    if (!nextOk) {
      throw new BadRequestException(`انتقال وضعیت از ${from} به ${status} مجاز نیست`);
    }

    // Payment = confirmed slot: cannot confirm/complete unpaid; cancel paid needs explicit reason
    const payStatus = existing.payment?.status;
    if (status === BookingStatus.confirmed || status === BookingStatus.completed) {
      if (payStatus && payStatus !== PaymentStatus.paid && payStatus !== PaymentStatus.refunded) {
        throw new BadRequestException('بدون پرداخت موفق نمی‌توان رزرو را تأیید یا تکمیل کرد');
      }
    }
    if (status === BookingStatus.cancelled && payStatus === PaymentStatus.paid) {
      if (!reason || !String(reason).trim()) {
        throw new BadRequestException('لغو رزرو پرداخت‌شده نیازمند دلیل است (استرداد جداگانه انجام شود)');
      }
    }

    const data: Prisma.BookingUpdateInput = { status };
    if (reason) data.cancelReason = reason;
    if (status === BookingStatus.cancelled) data.cancelledAt = new Date();
    if (status === BookingStatus.confirmed) data.confirmedAt = new Date();
    if (status === BookingStatus.completed) data.completedAt = new Date();
    if (status === BookingStatus.no_show) data.noShowAt = new Date();
    const updated = await this.prisma.booking.update({ where: { id }, data });
    await this.audit(actorId, 'booking.status_change', 'booking', id, { status: from, payStatus }, { status, reason });
    return updated;
  }

  async listReviews(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.ReviewWhereInput = {};
    if (q.isPublished === true) where.isPublished = true;
    else if (q.isPublished === false) where.isPublished = false;
    if (q.search?.trim()) {
      const s = String(q.search).trim();
      where.OR = [
        { comment: { contains: s, mode: 'insensitive' } },
        { customer: { phone: { contains: s } } },
        { customer: { profile: { displayName: { contains: s, mode: 'insensitive' } } } },
        { professional: { title: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, phone: true, profile: { select: { displayName: true } } } },
          professional: { select: { id: true, title: true, slug: true } },
          booking: { select: { id: true, startAt: true, status: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  private async recalcProfessionalRating(tx: Prisma.TransactionClient, professionalId: string) {
    const agg = await tx.review.aggregate({
      where: { professionalId, isPublished: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const ratingAvg = agg._count._all > 0 ? Number(agg._avg.rating || 0) : 0;
    const ratingCount = agg._count._all;
    await tx.professional.update({
      where: { id: professionalId },
      data: { ratingAvg, ratingCount },
    });
    return { ratingAvg, ratingCount };
  }

  async setReviewPublished(id: string, isPublished: boolean, actorId?: string) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('نظر یافت نشد');
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.review.update({
        where: { id },
        data: { isPublished },
      });
      await this.recalcProfessionalRating(tx, existing.professionalId);
      return row;
    });
    await this.audit(
      actorId,
      isPublished ? 'review.publish' : 'review.hide',
      'review',
      id,
      { isPublished: existing.isPublished },
      { isPublished },
    );
    return updated;
  }

  async deleteReview(id: string, actorId?: string, reason?: string) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('نظر یافت نشد');
    await this.prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });
      await this.recalcProfessionalRating(tx, existing.professionalId);
    });
    await this.audit(actorId, 'review.delete', 'review', id, { ...existing, deleteReason: reason || null }, null);
    return { message: 'نظر حذف شد', id };
  }

  async listNotifications(q?: any) {
    const page = Math.max(1, Number(q?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q?.limit) || 30));
    const where: Prisma.NotificationWhereInput = {};
    if (q?.userId?.trim()) where.userId = String(q.userId).trim();
    if (q?.type) where.type = q.type;
    if (q?.search?.trim()) {
      const s = String(q.search).trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { body: { contains: s, mode: 'insensitive' } },
      ];
    }
    // #r4.M1 — without userId, only return aggregate counts (no full dump)
    if (!where.userId && !q?.search?.trim()) {
      const total = await this.prisma.notification.count({ where });
      return {
        items: [],
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
        notice: 'برای فهرست کامل، userId را مشخص کنید',
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }


  /**
   * #82.18 — Start customer impersonation.
   * Only SUPER_ADMIN (re-checked against DB, not only JWT roles).
   * Audit log is required: if audit insert fails, the request fails (no silent start).
   */
  async impersonateCustomer(adminId: string, customerId: string) {
    if (!adminId) {
      throw new ForbiddenException('SUPER_ADMIN only');
    }
    if (adminId === customerId) {
      throw new BadRequestException('cannot impersonate yourself');
    }
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!admin) throw new NotFoundException('admin not found');
    if (admin.status !== 'active') {
      throw new ForbiddenException('admin account is not active');
    }
    const adminRoles = admin.userRoles.map((ur) => ur.role.name);
    if (!adminRoles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('SUPER_ADMIN only');
    }
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      include: {
        profile: true,
        userRoles: { include: { role: true } },
        professional: { select: { id: true } },
      },
    });
    if (!customer) throw new NotFoundException('customer not found');
    if (customer.status !== 'active') {
      throw new BadRequestException('customer not active');
    }
    const customerRoles = customer.userRoles.map((ur) => ur.role.name);
    if (customerRoles.some((r) => r === 'SUPER_ADMIN' || r === 'admin')) {
      throw new ForbiddenException('cannot impersonate admin');
    }
    if (customer.accountType === 'professional' && !customerRoles.includes('customer')) {
      throw new BadRequestException('not a customer account');
    }

    // #82.18 — durable audit BEFORE issuing token; failure blocks impersonation
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'IMPERSONATION_STARTED',
          entityType: 'user',
          entityId: customer.id,
          after: {
            customerUserId: customer.id,
            customerPhone: customer.phone,
            customerName: customer.profile?.displayName || null,
            adminUserId: adminId,
          } as any,
        },
      });
    } catch (err) {
      this.logger.error(
        `IMPERSONATION_STARTED audit failed for admin=${adminId} customer=${customerId}: ${(err as Error).message}`,
      );
      throw new BadRequestException(
        'ثبت لاگ impersonation ناموفق بود؛ برای امنیت عملیات متوقف شد',
      );
    }

    const tokens = await this.authService.issueImpersonationAccessToken(
      customer.id,
      customer.phone,
      adminId,
    );
    this.logger.warn(
      `IMPERSONATION_STARTED admin=${adminId} customer=${customer.id}`,
    );
    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      customer: {
        id: customer.id,
        phone: customer.phone,
        displayName: customer.profile?.displayName || null,
        accountType: customer.accountType,
        roles: customerRoles,
      },
    };
  }
  async listAuditLogs(q?: any) {
    const page = Math.max(1, Number(q?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q?.limit) || 50));
    const where: Prisma.AuditLogWhereInput = {};
    if (q?.action?.trim()) {
      where.action = { contains: String(q.action).trim(), mode: 'insensitive' };
    }
    if (q?.entityType?.trim()) where.entityType = String(q.entityType).trim();
    if (q?.entityId?.trim()) where.entityId = String(q.entityId).trim();
    if (q?.actorId?.trim()) where.actorId = String(q.actorId).trim();
    if (q?.startDate || q?.endDate) {
      where.createdAt = {};
      if (q?.startDate) {
        const d = new Date(q.startDate);
        if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
      }
      if (q?.endDate) {
        const d = new Date(q.endDate);
        if (!Number.isNaN(d.getTime())) {
          if (String(q.endDate).length <= 10) d.setHours(23, 59, 59, 999);
          where.createdAt.lte = d;
        }
      }
    }
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      action: r.action,
      entity: r.entityType,
      entityType: r.entityType,
      entityId: r.entityId,
      actorId: r.actorId,
      actor: r.actor
        ? {
            id: r.actor.id,
            phone: r.actor.phone,
            displayName: r.actor.profile?.displayName ?? null,
          }
        : null,
      before: r.before,
      after: r.after,
      meta: r.after ?? r.before,
      // #r4.M3 — ipAddress omitted from list (privacy); available in detail if needed
      createdAt: r.createdAt,
    }));
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async listMedia(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 24));
    const skip = (page - 1) * limit;
    const where: Prisma.MediaAssetWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.kind) where.kind = q.kind;
    if (q.professionalId) where.professionalId = q.professionalId;
    if (q.search?.trim()) {
      const s = String(q.search).trim();
      where.OR = [
        { url: { contains: s, mode: 'insensitive' } },
        { storageKey: { contains: s, mode: 'insensitive' } },
        { mimeType: { contains: s, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: {
            select: {
              id: true,
              title: true,
              slug: true,
              user: { select: { profile: { select: { displayName: true } } } },
            },
          },
        },
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async getMediaStats() {
    const [total, draft, published, byKind] = await Promise.all([
      this.prisma.mediaAsset.count(),
      this.prisma.mediaAsset.count({ where: { status: MediaStatus.draft } }),
      this.prisma.mediaAsset.count({ where: { status: MediaStatus.published } }),
      this.prisma.mediaAsset.groupBy({ by: ['kind'], _count: { _all: true } }),
    ]);
    const sizeAgg = await this.prisma.mediaAsset.aggregate({ _sum: { sizeBytes: true } });
    return {
      total,
      draft,
      published,
      totalSizeBytes: Number(sizeAgg._sum.sizeBytes || 0),
      byKind: byKind.map((k) => ({ kind: k.kind, count: k._count._all })),
    };
  }

  async setMediaStatus(id: string, status: MediaStatus, actorId?: string) {
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Media not found');
    const updated = await this.prisma.mediaAsset.update({ where: { id }, data: { status } });
    // #r4.M4 — purge storage when media is rejected/deleted
    if (status === MediaStatus.draft) { // purge on unpublish/reject-to-draft
      const storageKey = (existing as any).storageKey || (existing as any).key || (existing as any).path;
      if (storageKey && this.storage.delete) {
        try {
          await this.storage.delete(String(storageKey));
        } catch (e) {
          this.logger.warn(`setMediaStatus storage delete failed: ${(e as Error)?.message || e}`);
        }
      }
    }
    await this.audit(actorId, 'media.status_change', 'media_asset', id, { status: existing.status }, { status });
    return updated;
  }


  async hardDeleteUser(id: string, actorId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { professional: true } });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.professional) {
      throw new BadRequestException('این حساب زیباگر است. برای حذف از بخش زیباگرها اقدام کنید.');
    }
    // #r4.gap — preserve financial/booking history: any booking or payment blocks hard delete
    const anyBookings = await this.prisma.booking.count({ where: { customerId: id } });
    if (anyBookings > 0) {
      throw new BadRequestException(
        'این کاربر سابقه رزرو دارد؛ حذف دائمی مجاز نیست. از تعلیق حساب استفاده کنید',
      );
    }
    const anyPayments = await this.prisma.payment.count({
      where: { booking: { customerId: id } },
    });
    if (anyPayments > 0) {
      throw new BadRequestException(
        'سوابق پرداخت وجود دارد؛ حذف دائمی مجاز نیست. از تعلیق حساب استفاده کنید',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { customerId: id } });
      await tx.refreshToken.deleteMany({ where: { userId: id } }).catch(() => undefined as never);
      await tx.user.delete({ where: { id } });
    });
    await this.audit(actorId, 'user.hard_delete', 'user', id, { phone: existing.phone }, null);
    return { id, deleted: true };
  }

  async bulkHardDeleteUsers(userIds: string[], actorId?: string) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean))).slice(0, 50);
    if ((userIds || []).length > 50) {
      throw new BadRequestException('حداکثر ۵۰ کاربر در هر درخواست');
    }
    // All-or-nothing precheck: if any ID has history, delete none
    const blocked: string[] = [];
    for (const id of ids) {
      const [bookings, payments] = await Promise.all([
        this.prisma.booking.count({ where: { customerId: id } }),
        this.prisma.payment.count({ where: { booking: { customerId: id } } }),
      ]);
      if (bookings > 0 || payments > 0) blocked.push(id);
    }
    if (blocked.length) {
      throw new BadRequestException(
        `حذف گروهی متوقف شد؛ این کاربران سابقه رزرو/پرداخت دارند: ${blocked.slice(0, 5).join(', ')}`,
      );
    }
    // Sequential deletes after precheck (each hardDeleteUser has its own tx).
    const deletedIds: string[] = [];
    const failed: { id: string; error: string }[] = [];
    let stopAt = -1;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      try {
        await this.hardDeleteUser(id, actorId);
        deletedIds.push(id);
      } catch (e) {
        failed.push({ id, error: (e as Error)?.message || String(e) });
        stopAt = i;
        break;
      }
    }
    const skipped =
      stopAt >= 0 ? ids.slice(stopAt + 1).map((id) => ({ id, reason: 'not_attempted_after_error' })) : [];
    return {
      deleted: deletedIds.length,
      failed,
      skipped,
      cappedAt: 50,
      deletedIds,
      partial: failed.length > 0 || skipped.length > 0,
    };
  }

  async hardDeleteProfessional(id: string, actorId?: string) {
    const pro = await this.prisma.professional.findUnique({ where: { id } });
    if (!pro) throw new NotFoundException('Professional not found');
    // #r4.gap — any historical booking/payment blocks hard delete
    const anyBookings = await this.prisma.booking.count({ where: { professionalId: id } });
    if (anyBookings > 0) {
      throw new BadRequestException(
        'این زیباگر سابقه رزرو دارد؛ حذف دائمی مجاز نیست. از تعلیق پروفایل استفاده کنید',
      );
    }
    const anyPayments = await this.prisma.payment.count({
      where: { booking: { professionalId: id } },
    });
    if (anyPayments > 0) {
      throw new BadRequestException(
        'سوابق پرداخت مرتبط وجود دارد؛ حذف دائمی مجاز نیست',
      );
    }
    const media = await this.prisma.mediaAsset.findMany({
      where: { professionalId: id },
      select: { id: true, storageKey: true, url: true },
    });
    for (const m of media) {
      const key = m.storageKey || null;
      if (key && this.storage.delete) {
        try {
          await this.storage.delete(key);
        } catch (e) {
          this.logger.warn(`hardDeleteProfessional storage delete ${key}: ${(e as Error)?.message || e}`);
        }
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { professionalId: id } });
      await tx.mediaAsset.deleteMany({ where: { professionalId: id } });
      await tx.professional.delete({ where: { id } });
    });
    await this.audit(actorId, 'professional.hard_delete', 'professional', id, { userId: pro.userId, slug: pro.slug }, null);
    return { id, deleted: true };
  }

  async deleteMedia(id: string, actorId?: string) {
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Media not found');
    await this.prisma.mediaAsset.delete({ where: { id } });
    const storageKey = (existing as any).storageKey || (existing as any).key || (existing as any).path;
    if (storageKey && this.storage.delete) {
      try {
        await this.storage.delete(String(storageKey));
      } catch (e) {
        this.logger.warn(`storage delete failed key=${storageKey}: ${(e as Error)?.message || e}`);
      }
    }
    await this.audit(actorId, 'media.delete', 'media_asset', id, existing, null);
    return { success: true, id };
  }

  async getPublishedSiteConfig() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_published' } });
    const value = (row?.value as any) || {};
    const nested = value.content || {};
    const content = {
      hero: nested.hero || value.hero || {},
      texts: nested.texts || value.texts || {},
      features: nested.features || value.features || {},
    };
    return {
      version: value.version || 1,
      content,
      sections: Array.isArray(value.sections) ? value.sections : [],
      publishedAt: value.publishedAt || null,
    };
  }

  async publishSiteCms(actorId?: string) {
    const [contentRow, sectionsRow, legacyDraft] = await Promise.all([
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_content' } }),
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_sections' } }),
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_draft' } }),
    ]);
    const content = (contentRow?.value as any) || {};
    const sections = Array.isArray(sectionsRow?.value)
      ? sectionsRow!.value
      : Array.isArray((sectionsRow?.value as any)?.sections)
        ? (sectionsRow!.value as any).sections
        : [];
    const legacy = (legacyDraft?.value as any) || {};
    const value = {
      version: 1,
      content: Object.keys(content).length ? content : (legacy.content || {}),
      hero: content.hero || legacy.hero || {},
      texts: content.texts || legacy.texts || {},
      features: content.features || legacy.features || {},
      sections: sections.length ? sections : (legacy.sections || []),
      publishedAt: new Date().toISOString(),
    } as any;
    await this.prisma.platformSetting.upsert({
      where: { key: 'site_cms_published' },
      create: { key: 'site_cms_published', value },
      update: { value },
    });
    // Keep draft as-is so unpublished edits are not wiped (#r4.C7)
    await this.audit(actorId, 'site_cms.publish', 'platform_setting', 'site_cms_published', null, value);
    return { success: true, publishedAt: value.publishedAt };
  }

  async uploadSiteCmsImage(
    file: {
      buffer?: Buffer;
      path?: string;
      mimetype: string;
      originalname: string;
      size: number;
    },
    slot?: string,
    actorId?: string,
  ) {
    if (!file) throw new BadRequestException('فایل ارسال نشده است');
    let buffer: Buffer;
    if (file.buffer?.length) {
      buffer = file.buffer;
    } else if (file.path) {
      // Cap read to 12MB to avoid memory blow (#r4.M5)
      const st = fs.statSync(file.path);
      if (st.size > 12 * 1024 * 1024) throw new BadRequestException('حجم فایل بیش از حد مجاز است');
      buffer = fs.readFileSync(file.path);
    } else {
      throw new BadRequestException('فایل خالی است');
    }
    assertUploadSize(buffer.length, file.mimetype);
    assertNotSuspicious(buffer, file.mimetype);
    const sniffed = sniffImage(buffer);
    if (!sniffed || sniffed.kind === 'heic') {
      throw new BadRequestException('فقط تصویر JPEG/PNG/WebP/GIF مجاز است');
    }
    const key = `cms/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${sniffed.ext}`;
    const mime = sniffed.mime;
    let storageKey: string;
    try {
      storageKey = await this.storage.upload(key, buffer, mime);
    } catch (e) {
      this.logger.warn(`CMS upload via storage provider failed: ${(e as Error)?.message || e}`);
      throw new BadRequestException('ذخیره فایل ناموفق بود. تنظیمات ذخیره‌سازی را بررسی کنید.');
    }
    const url = this.storage.getPublicUrl(storageKey);
    await this.audit(actorId, 'site_cms.upload', 'platform_setting', storageKey, null, {
      url,
      slot: slot || 'generic',
      size: buffer.length,
      mime,
    });
    return {
      url,
      key: storageKey,
      slot: slot || 'generic',
      mimeType: mime,
      size: buffer.length,
    };
  }
  /** Overlay env-backed runtime values so panel keys match process env (#r4.H2 gap). */
  private envOverlay(): Record<string, unknown> {
    // Defaults aligned with bookings/auth runtime env fallbacks
    return {
      booking: {
        cancelWindowHours: Number(process.env.BOOKING_FREE_CANCEL_HOURS || 24),
        holdMinutes: Number(process.env.BOOKING_HOLD_MINUTES || 15),
        minLeadHours: Number(process.env.BOOKING_MIN_LEAD_HOURS || 4),
      },
      auth: {
        maxOtpAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 3),
        otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS || 300),
        loginRateLimitPerMinute: Number(process.env.AUTH_LOGIN_RATE_LIMIT || 10),
      },
    };
  }

  private platformDefaults() {
    return {
      booking: {
        slotStepMin: 30,
        holdMinutes: 15,
        cancelWindowHours: 24,
        allowSameDay: true,
      },
      commission: { ratePercent: 10 },
      professionals: {
        requireManualReview: true,
        minServicesToPublish: 1,
      },
      reviews: {
        autoPublish: false,
        minCommentLength: 10,
      },
      search: {
        nearMeDefaultRadiusKm: 5,
        featuredBoost: true,
      },
      auth: {
        otpTtlSeconds: 300,
        maxOtpAttempts: 3,
        loginRateLimitPerMinute: 10,
      },
      privacy: {
        defaultLocationPrecision: 'approximate' as const,
        showPhoneToCustomer: false,
      },
      public: {
        siteName: 'Beautijoo',
        supportPhone: '',
        maintenanceMode: false,
      },
    };
  }

  private deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>) {
    const out: Record<string, unknown> = { ...base };
    for (const [k, v] of Object.entries(patch || {})) {
      if (
        v &&
        typeof v === 'object' &&
        !Array.isArray(v) &&
        typeof out[k] === 'object' &&
        out[k] !== null &&
        !Array.isArray(out[k])
      ) {
        out[k] = this.deepMerge(
          out[k] as Record<string, unknown>,
          v as Record<string, unknown>,
        );
      } else if (v !== undefined) {
        out[k] = v;
      }
    }
    return out;
  }

  /** Raw panel JSON only (no env merge) — safe for read-modify-write saves. */
  private async getStoredPlatformConfig(): Promise<Record<string, unknown>> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: 'platform_config' },
    });
    if (row?.value && typeof row.value === 'object' && !Array.isArray(row.value)) {
      return row.value as Record<string, unknown>;
    }
    return {};
  }

  async getPlatformSettings() {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: 'platform_config' },
    });
    const stored =
      row?.value && typeof row.value === 'object' && !Array.isArray(row.value)
        ? (row.value as Record<string, unknown>)
        : {};
    // defaults <- env fallbacks <- stored panel (panel wins when set)
    const withEnv = this.deepMerge(
      this.platformDefaults() as unknown as Record<string, unknown>,
      this.envOverlay(),
    );
    return this.deepMerge(withEnv, stored);
  }

  async updatePlatformSettings(
    partial: Record<string, unknown>,
    actorId?: string,
  ) {
    const current = this.deepMerge(
      this.platformDefaults() as unknown as Record<string, unknown>,
      await this.getStoredPlatformConfig(),
    ); // never seed DB with env snapshot

    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(partial || {})) {
      if (ALLOWED_PLATFORM_ROOT_KEYS.has(k)) cleaned[k] = v;
    }
    const next = this.deepMerge(current as Record<string, unknown>, cleaned);

    const commission = next.commission as { ratePercent?: number } | undefined;
    if (commission && typeof commission.ratePercent === 'number') {
      const rate = Math.min(100, Math.max(0, commission.ratePercent));
      (next.commission as { ratePercent: number }).ratePercent = rate;
      await this.prisma.platformSetting.upsert({
        where: { key: 'commission_rate' },
        create: { key: 'commission_rate', value: { rate } as object },
        update: { value: { rate } as object },
      });
    }

    await this.prisma.platformSetting.upsert({
      where: { key: 'platform_config' },
      create: { key: 'platform_config', value: next as object },
      update: { value: next as object },
    });

    await this.audit(
      actorId,
      'platform.settings_update',
      'platform_setting',
      'platform_config',
      null,
      { keys: Object.keys(partial || {}) },
    );

    return next;
  }

  async getNavBadges() {
    const [
      professionals,
      bookings,
      reviews,
      support,
      media,
    ] = await Promise.all([
      this.prisma.professional.count({
        where: { status: ProfessionalStatus.pending_review },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.pending },
      }),
      this.prisma.review.count({
        where: { isPublished: false },
      }),
      this.prisma.supportTicket.count({
        where: { status: 'open' },
      }),
      this.prisma.mediaAsset.count({
        where: { status: MediaStatus.draft },
      }),
    ]);

    return {
      professionals,
      bookings,
      reviews,
      support,
      media,
      notifications: 0,
    };
  }


  // #75 — admin payout queue
  async listPayoutRequests(page = 1, limit = 20, status?: string) {
    const take = Math.min(Math.max(limit || 20, 1), 100);
    const skip = (Math.max(page || 1, 1) - 1) * take;
    const where: { status?: PayoutStatus } = {};
    if (status && ['pending', 'approved', 'paid', 'rejected', 'cancelled'].includes(status)) {
      where.status = status as PayoutStatus;
    }
    const [items, total] = await Promise.all([
      this.prisma.payoutRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          professional: {
            select: {
              id: true,
              title: true,
              user: { select: { phone: true, profile: { select: { displayName: true } } } },
            },
          },
        },
      }),
      this.prisma.payoutRequest.count({ where }),
    ]);
    return {
      items,
      meta: { page: Math.max(1, page), limit: take, total, totalPages: Math.ceil(total / take) || 0 },
    };
  }

  async updatePayoutRequest(
    adminUserId: string,
    id: string,
    status: 'approved' | 'paid' | 'rejected',
    note?: string,
  ) {
    const row = await this.prisma.payoutRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('درخواست تسویه یافت نشد');
    const from = String(row.status);
    const allowed: Record<string, string[]> = {
      pending: ['approved', 'rejected'],
      approved: ['paid', 'rejected'],
      paid: [],
      rejected: [],
      cancelled: [],
    };
    if (!(allowed[from] || []).includes(status)) {
      throw new BadRequestException(`انتقال وضعیت تسویه از ${from} به ${status} مجاز نیست`);
    }
    const updated = await this.prisma.payoutRequest.update({
      where: { id },
      data: {
        status: status as PayoutStatus,
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
        adminNote: note != null ? note : undefined,
      },
    });
    await this.audit(
      adminUserId,
      'finance.payout_update',
      'payout_request',
      id,
      { status: row.status },
      { status, note: note ?? null },
    );
    return updated;
  }
}
