import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
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
import * as fs from 'fs';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage.provider';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

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
      pending: {
        professionalsAwaitingReview: pendingProfessionals,
        pendingPayments,
        failedPayments,
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
    if (!platformCommission && grossRevenue) {
      const rate = (await this.getCommissionSetting()).rate;
      platformCommission = Math.round(grossRevenue * (rate / 100));
      professionalNet = Math.max(0, grossRevenue - platformCommission);
    }
    return {
      period,
      grossRevenue,
      platformCommission,
      professionalNet,
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
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
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
    return u;
  }

  async setUserStatus(id: string, status: UserStatus | string, actorId?: string, reason?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({ where: { id }, data: { status: status as UserStatus } });
    await this.audit(actorId, 'user.status_change', 'user', id, { status: existing.status }, { status, reason });
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

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: roleRows.map((r) => ({
          userId: id,
          roleId: r.id,
          assignedBy: actorId || null,
        })),
      });
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
      data.publishedAt = existing.publishedAt || new Date();
      data.verifiedAt = existing.verifiedAt || new Date();
    } else if (
      status === ProfessionalStatus.rejected ||
      status === ProfessionalStatus.suspended ||
      status === ProfessionalStatus.draft
    ) {
      data.publishedAt = null;
    }

    const updated = await this.prisma.professional.update({ where: { id }, data });

    // On approve, publish draft portfolio media so it becomes visible
    if (status === ProfessionalStatus.approved) {
      await this.prisma.mediaAsset
        .updateMany({
          where: { professionalId: id, status: MediaStatus.draft },
          data: { status: MediaStatus.published },
        })
        .catch(() => undefined);
    }

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
    const commissionRate = 10;
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
    if (q.status) where.status = q.status;
    if (q.paymentStatus) where.payment = { status: q.paymentStatus };
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
    const existing = await this.prisma.booking.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Booking not found');
    const data: Prisma.BookingUpdateInput = { status };
    if (reason) data.cancelReason = reason;
    if (status === BookingStatus.cancelled) data.cancelledAt = new Date();
    if (status === BookingStatus.confirmed) data.confirmedAt = new Date();
    if (status === BookingStatus.completed) data.completedAt = new Date();
    const updated = await this.prisma.booking.update({ where: { id }, data });
    await this.audit(actorId, 'booking.status_change', 'booking', id, { status: existing.status }, { status, reason });
    return updated;
  }

  async listReviews(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count(),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async listNotifications(q?: any) {
    const page = Math.max(1, Number(q?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q?.limit) || 30));
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count(),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async listAuditLogs(q?: any) {
    const page = Math.max(1, Number(q?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q?.limit) || 50));
    const where: Prisma.AuditLogWhereInput = {};
    if (q?.action) where.action = q.action;
    if (q?.entityType) where.entityType = q.entityType;
    if (q?.entityId) where.entityId = q.entityId;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
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
    await this.audit(actorId, 'media.status_change', 'media_asset', id, { status: existing.status }, { status });
    return updated;
  }


  async hardDeleteUser(id: string, actorId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { professional: true } });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.professional) {
      throw new BadRequestException('این حساب زیباگر است. برای حذف از بخش زیباگرها اقدام کنید.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { customerId: id } });
      await tx.booking.deleteMany({ where: { customerId: id } });
      await tx.user.delete({ where: { id } });
    });
    await this.audit(actorId, 'user.hard_delete', 'user', id, { phone: existing.phone }, null);
    return { id, deleted: true };
  }

  async bulkHardDeleteUsers(userIds: string[], actorId?: string) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean)));
    let deleted = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await this.hardDeleteUser(id, actorId);
        deleted += 1;
      } catch {
        failed.push(id);
      }
    }
    return { deleted, failed };
  }

  async hardDeleteProfessional(id: string, actorId?: string) {
    const pro = await this.prisma.professional.findUnique({ where: { id } });
    if (!pro) throw new NotFoundException('Professional not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { professionalId: id } });
      await tx.booking.deleteMany({ where: { professionalId: id } });
      await tx.professional.delete({ where: { id } });
    });
    await this.audit(actorId, 'professional.hard_delete', 'professional', id, { userId: pro.userId, slug: pro.slug }, null);
    return { id, deleted: true };
  }

  async deleteMedia(id: string, actorId?: string) {
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Media not found');
    await this.prisma.mediaAsset.delete({ where: { id } });
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
    await this.prisma.platformSetting.upsert({
      where: { key: 'site_cms_draft' },
      create: { key: 'site_cms_draft', value },
      update: { value },
    });
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
      buffer = fs.readFileSync(file.path);
    } else {
      throw new BadRequestException('فایل خالی است');
    }
    const safeName = (file.originalname || 'img').replace(/[^\w.\-]+/g, '_').slice(0, 80);
    const ext = (safeName.split('.').pop() || 'jpg').toLowerCase();
    const key = `cms/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const mime = file.mimetype || 'application/octet-stream';
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
      size: file.size,
    });
    return {
      url,
      key: storageKey,
      slot: slot || 'generic',
      mimeType: mime,
      size: file.size,
    };
  }
}
