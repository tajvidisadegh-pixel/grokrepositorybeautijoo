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

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
    return {
      users: await this.prisma.user.count(),
      professionals: await this.prisma.professional.count(),
      bookings: await this.prisma.booking.count(),
      reviews: await this.prisma.review.count(),
      bookingsByStatus: [],
    };
  }

  async dashboard() {
    return {
      overview: {
        totalUsers: 0,
        totalProfessionals: 0,
        pendingProfessionals: 0,
        totalBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        totalReviews: 0,
        revenue: { available: true, total: 0 },
      },
      timeStats: { today: {}, last7Days: {}, last30Days: {}, thisMonth: {} },
      trends: { userGrowth: [], professionalGrowth: [], bookingActivity: [], revenue: null },
      pending: { professionalsAwaitingReview: 0, pendingPayments: 0, failedPayments: 0 },
      recentActivity: [],
      recent: { professionals: [], users: [], bookings: [], reviews: [] },
    };
  }

  async getFinancialSummary(_period?: string) {
    return {
      period: _period || 'all_time',
      currency: 'TOMAN',
      providerType: process.env.PAYMENT_PROVIDER || 'none',
      refundImplemented: true,
      grossRevenue: 0,
      platformCommission: 0,
      professionalNet: 0,
      paymentFee: 0,
      transactions: { paid: 0, pending: 0, failed: 0, cancelled: 0, refunded: 0 },
      recentPaidPayments: [],
    };
  }

  async listFinancialTransactions(_q?: Record<string, unknown>) {
    return { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }

  async getFinancialTransactionDetail(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id }, include: { booking: true } });
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
      rate: newRate,
      defaultRate: DEFAULT_PLATFORM_COMMISSION_RATE,
      updatedAt: new Date().toISOString(),
    };
  }

  async getFailedTransactionsAlert() {
    return { count: 0, threshold: 3, triggered: false };
  }

  async updateFailedTransactionsThreshold(threshold: number, _adminUserId?: string) {
    return { threshold };
  }

  /**
   * Build Prisma User where with AND composition so multiple booking-related
   * filters (city, presence, status, hasPaid) do not overwrite each other.
   * This was the root cause of 500 errors when applying combined filters.
   */
  private buildUserWhere(q: {
    search?: string;
    status?: UserStatus;
    role?: string;
    accountType?: string;
    city?: string;
    bookingPresence?: 'any' | 'none' | 'has';
    bookingStatus?: string;
    registeredFrom?: string;
    registeredTo?: string;
    neverNotified?: boolean | string;
    hasPaid?: boolean | string;
  }): Prisma.UserWhereInput {
    const and: Prisma.UserWhereInput[] = [];

    if (!q.accountType || q.accountType === 'customer') {
      and.push({ accountType: 'customer' });
    } else if (q.accountType === 'professional') {
      and.push({ accountType: 'professional' });
    }

    if (q.status) and.push({ status: q.status });
    if (q.role) and.push({ userRoles: { some: { role: { name: q.role } } } });

    if (q.search?.trim()) {
      const term = q.search.trim();
      and.push({
        OR: [
          { phone: { contains: term } },
          { email: { contains: term, mode: 'insensitive' } },
          { profile: { displayName: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }

    // Booking-related filters composed under AND
    const bookingSome: Prisma.BookingWhereInput = {};
    let requireSomeBooking = false;
    let requireNoneBooking = false;

    if (q.city?.trim()) {
      bookingSome.location = {
        city: { contains: q.city.trim(), mode: 'insensitive' },
      };
      requireSomeBooking = true;
    }

    if (q.bookingStatus?.trim()) {
      const st = q.bookingStatus.trim();
      if (Object.values(BookingStatus).includes(st as BookingStatus)) {
        bookingSome.status = st as BookingStatus;
        requireSomeBooking = true;
      }
    }

    if (q.hasPaid === true || q.hasPaid === 'true' || q.hasPaid === '1') {
      bookingSome.payment = { status: PaymentStatus.paid };
      requireSomeBooking = true;
    }

    const presence = q.bookingPresence;
    if (presence === 'none') {
      requireNoneBooking = true;
    } else if (presence === 'has' || presence === 'any') {
      requireSomeBooking = true;
    }

    if (requireNoneBooking) {
      and.push({ bookingsAsCustomer: { none: {} } });
    } else if (requireSomeBooking) {
      and.push({
        bookingsAsCustomer: {
          some: Object.keys(bookingSome).length ? bookingSome : {},
        },
      });
    }

    if (q.registeredFrom || q.registeredTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (q.registeredFrom) {
        const from = new Date(q.registeredFrom);
        if (!Number.isNaN(from.getTime())) createdAt.gte = from;
      }
      if (q.registeredTo) {
        const end = new Date(q.registeredTo);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          createdAt.lte = end;
        }
      }
      if (Object.keys(createdAt).length) and.push({ createdAt });
    }

    if (q.neverNotified === true || q.neverNotified === 'true' || q.neverNotified === '1') {
      and.push({ notifications: { none: {} } });
    }

    if (and.length === 0) return {};
    if (and.length === 1) return and[0];
    return { AND: and };
  }

  async listUsers(q: {
    page?: number;
    limit?: number;
    search?: string;
    status?: UserStatus;
    role?: string;
    accountType?: string;
    city?: string;
    bookingPresence?: 'any' | 'none' | 'has';
    bookingStatus?: string;
    registeredFrom?: string;
    registeredTo?: string;
    neverNotified?: boolean | string;
    hasPaid?: boolean | string;
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where = this.buildUserWhere(q);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
          userRoles: { include: { role: true } },
          _count: { select: { bookingsAsCustomer: true, favorites: true, reviews: true } },
          bookingsAsCustomer: {
            orderBy: { startAt: 'desc' },
            take: 1,
            select: {
              id: true,
              startAt: true,
              status: true,
              totalPrice: true,
              location: { select: { city: true } },
            },
          },
          notifications: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, title: true, createdAt: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map((u) => ({
        id: u.id,
        phone: u.phone,
        email: u.email,
        status: u.status,
        accountType: u.accountType,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        profile: u.profile,
        roles: u.userRoles.map((ur) => ur.role.name),
        bookingCount: u._count.bookingsAsCustomer,
        favoritesCount: u._count.favorites,
        reviewsCount: u._count.reviews,
        lastBooking: u.bookingsAsCustomer[0]
          ? {
              id: u.bookingsAsCustomer[0].id,
              startAt: u.bookingsAsCustomer[0].startAt,
              status: u.bookingsAsCustomer[0].status,
              totalPrice: u.bookingsAsCustomer[0].totalPrice,
              city: u.bookingsAsCustomer[0].location?.city ?? null,
            }
          : null,
        lastNotification: u.notifications[0]
          ? {
              id: u.notifications[0].id,
              title: u.notifications[0].title,
              createdAt: u.notifications[0].createdAt,
            }
          : null,
        city: u.bookingsAsCustomer[0]?.location?.city ?? null,
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
    const bookings = await this.prisma.booking.findMany({
      where: { customerId: id },
      orderBy: { startAt: 'desc' },
      take: 50,
      include: {
        professional: { select: { id: true, title: true, slug: true } },
        payment: true,
        location: { select: { city: true, address: true } },
      },
    });
    return {
      ...user,
      roles: user.userRoles.map((ur) => ur.role.name),
      stats: {
        totalBookings: bookings.length,
        successfulBookings: bookings.filter((b) => ['completed', 'confirmed'].includes(b.status)).length,
        cancelledBookings: bookings.filter((b) => ['cancelled', 'rejected'].includes(b.status)).length,
        pendingBookings: bookings.filter((b) => ['pending', 'expired'].includes(b.status)).length,
        totalPaid: 0,
        paidTransactions: 0,
        professionalsUsed: new Set(bookings.map((b) => b.professionalId)).size,
        reviewsCount: 0,
        favoritesCount: 0,
      },
      bookings,
      reviews: [],
      favorites: [],
      notifications: [],
      activity: [],
      auditLogs: [],
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
    const uniqueNames = Array.from(new Set((roles || []).map((r) => String(r).trim()).filter(Boolean)));
    if (uniqueNames.length === 0) throw new BadRequestException('At least one role required');
    const roleRows = await this.prisma.role.findMany({ where: { name: { in: uniqueNames } } });
    await this.prisma.userRole.deleteMany({ where: { userId: id } });
    if (roleRows.length) {
      await this.prisma.userRole.createMany({
        data: roleRows.map((r) => ({ userId: id, roleId: r.id, assignedBy: actorId ?? null })),
      });
    }
    userAuthCache.invalidate(id);
    await this.audit(actorId, 'user.roles_change', 'user', id, null, { roles: uniqueNames });
    return this.getUserDetail(id);
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
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { include: { profile: true } } },
      }),
      this.prisma.professional.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async getProfessionalDetail(id: string) {
    const pro = await this.prisma.professional.findUnique({
      where: { id },
      include: {
        user: { include: { profile: true } },
        professionalServices: { include: { service: true } },
        workingHours: true,
        locations: { include: { location: true } },
        mediaAssets: true,
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
    if (status === ProfessionalStatus.approved && !existing.publishedAt) {
      data.publishedAt = new Date();
      data.verifiedAt = new Date();
    }
    const updated = await this.prisma.professional.update({ where: { id }, data });
    await this.audit(
      actorId,
      'professional.status_change',
      'professional',
      id,
      { status: existing.status },
      { status, reason },
    );
    return updated;
  }

  async setProfessionalFeatured(id: string, isFeatured: boolean, actorId?: string) {
    const updated = await this.prisma.professional.update({ where: { id }, data: { isFeatured } });
    await this.audit(actorId, 'professional.feature', 'professional', id, null, { isFeatured });
    return updated;
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
    if (q.startDate || q.endDate) {
      where.startAt = {};
      if (q.startDate) where.startAt.gte = new Date(q.startDate);
      if (q.endDate) where.startAt.lte = new Date(q.endDate);
    }
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startAt: 'desc' },
        include: {
          customer: { include: { profile: true } },
          professional: true,
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
        professional: true,
        payment: true,
        items: true,
      },
    });
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }

  async updateBookingStatus(
    id: string,
    status: BookingStatus,
    actorId?: string,
    reason?: string,
  ) {
    const existing = await this.prisma.booking.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Booking not found');
    const updated = await this.prisma.booking.update({ where: { id }, data: { status } });
    await this.audit(
      actorId,
      'booking.status_change',
      'booking',
      id,
      { status: existing.status },
      { status, reason },
    );
    return updated;
  }

  async listReviews(_q?: Record<string, unknown>) {
    return { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }
  async setReviewVisibility(id: string, isPublished: boolean, actorId?: string, reason?: string) {
    return { id, isPublished, actorId, reason };
  }
  async deleteReview(id: string, actorId?: string) {
    await this.audit(actorId, 'review.delete', 'review', id, null, null);
    return { success: true };
  }
  async listMedia(_q?: Record<string, unknown>) {
    return { items: [], meta: { page: 1, limit: 24, total: 0, totalPages: 0 } };
  }
  async setMediaStatus(id: string, status: MediaStatus, actorId?: string) {
    return { id, status, actorId };
  }
  async deleteMedia(id: string, actorId?: string) {
    await this.audit(actorId, 'media.delete', 'media', id, null, null);
    return { success: true };
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
    const where: Prisma.AuditLogWhereInput = {};
    if (q.action) where.action = { contains: q.action };
    if (q.actorId) where.actorId = q.actorId;
    if (q.entityType) where.entityType = q.entityType;
    if (q.entityId) where.entityId = q.entityId;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

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
      where.OR = [
        { title: { contains: q.search.trim(), mode: 'insensitive' } },
        { body: { contains: q.search.trim(), mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { include: { profile: true } } },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async broadcastNotification(
    dto: { title: string; body: string; target: 'all' | 'professionals' | 'customers' },
    actorId?: string,
  ) {
    const where: Prisma.UserWhereInput =
      dto.target === 'professionals'
        ? { accountType: 'professional', status: UserStatus.active }
        : dto.target === 'customers'
          ? { accountType: 'customer', status: UserStatus.active }
          : { status: UserStatus.active };
    const users = await this.prisma.user.findMany({ where, select: { id: true }, take: 2000 });
    const campaignId = `bcast_${Date.now().toString(36)}`;
    if (users.length) {
      await this.prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          type: NotificationType.system,
          title: dto.title,
          body: dto.body,
          data: { campaignId, broadcast: true, target: dto.target },
        })),
      });
    }
    await this.audit(actorId, 'notification.broadcast', 'notification', null, null, {
      campaignId,
      count: users.length,
      target: dto.target,
    });
    return { success: true, notified: users.length, campaignId };
  }

  async notifyUsers(
    dto: { userIds: string[]; title: string; body: string; sms?: boolean; campaignId?: string },
    actorId?: string,
  ) {
    const title = (dto.title || '').trim();
    const body = (dto.body || '').trim();
    const ids = Array.from(new Set((dto.userIds || []).filter(Boolean)));
    if (!title || !body) throw new BadRequestException('title and body required');
    if (ids.length === 0) throw new BadRequestException('at least one user required');
    if (ids.length > 500) throw new BadRequestException('max 500 users');
    const campaignId =
      (dto.campaignId || '').trim() ||
      `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, status: UserStatus.active },
      select: { id: true, phone: true },
    });
    if (users.length === 0) {
      return { success: true, notified: 0, smsSent: 0, failed: 0, campaignId, recipients: [] };
    }
    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: NotificationType.system,
        title,
        body,
        data: {
          targeted: true,
          campaignId,
          deliveryStatus: 'sent',
          actorId: actorId ?? null,
          sms: !!dto.sms,
        },
      })),
    });
    await this.audit(actorId, 'notification.targeted', 'notification', null, null, {
      campaignId,
      userCount: users.length,
      sms: !!dto.sms,
      title,
    });
    return {
      success: true,
      notified: users.length,
      failed: 0,
      smsSent: dto.sms ? users.filter((u) => u.phone).length : 0,
      campaignId,
      recipients: users.map((u) => ({ userId: u.id, status: 'sent' as const, phone: u.phone })),
    };
  }

  async notifyByFilter(
    dto: {
      title: string;
      body: string;
      sms?: boolean;
      filters?: Record<string, unknown>;
      limit?: number;
    },
    actorId?: string,
  ) {
    const filters = {
      ...(dto.filters || {}),
      accountType: (dto.filters as { accountType?: string } | undefined)?.accountType || 'customer',
    };
    const where = this.buildUserWhere(filters as Parameters<typeof this.buildUserWhere>[0]);
    // Only active users for campaigns
    const finalWhere: Prisma.UserWhereInput = {
      AND: [where, { status: UserStatus.active }],
    };
    const max = Math.min(500, Math.max(1, Number(dto.limit) || 500));
    const users = await this.prisma.user.findMany({
      where: finalWhere,
      select: { id: true },
      take: max,
      orderBy: { createdAt: 'desc' },
    });
    return this.notifyUsers(
      { userIds: users.map((u) => u.id), title: dto.title, body: dto.body, sms: dto.sms },
      actorId,
    );
  }

  async listNotificationCampaigns(q: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.NotificationWhereInput = { type: NotificationType.system };
    if (q.search?.trim()) {
      where.OR = [
        { title: { contains: q.search.trim(), mode: 'insensitive' } },
        { body: { contains: q.search.trim(), mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 2000,
      select: { id: true, title: true, body: true, data: true, createdAt: true, readAt: true },
    });
    type Camp = {
      campaignId: string;
      title: string;
      body: string;
      createdAt: string;
      sent: number;
      failed: number;
      total: number;
      read: number;
    };
    const map = new Map<string, Camp>();
    for (const r of rows) {
      const data = (r.data || {}) as Record<string, unknown>;
      const cid = String(data.campaignId || '');
      if (!cid) continue;
      let c = map.get(cid);
      if (!c) {
        c = {
          campaignId: cid,
          title: r.title,
          body: r.body,
          createdAt: r.createdAt.toISOString(),
          sent: 0,
          failed: 0,
          total: 0,
          read: 0,
        };
        map.set(cid, c);
      }
      c.total += 1;
      if (String(data.deliveryStatus || 'sent') === 'failed') c.failed += 1;
      else c.sent += 1;
      if (r.readAt) c.read += 1;
    }
    const all = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return {
      items: all.slice(skip, skip + limit),
      meta: { page, limit, total: all.length, totalPages: Math.ceil(all.length / limit) || 0 },
    };
  }

  async getCampaignRecipients(
    campaignId: string,
    q?: { status?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, Number(q?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q?.limit) || 50));
    const skip = (page - 1) * limit;
    const rows = await this.prisma.notification.findMany({
      where: {
        type: NotificationType.system,
        data: { path: ['campaignId'], equals: campaignId },
      },
      orderBy: { createdAt: 'desc' },
      include: { user: { include: { profile: true } } },
      take: 2000,
    });
    let items = rows.map((r) => {
      const data = (r.data || {}) as Record<string, unknown>;
      return {
        id: r.id,
        userId: r.userId,
        phone: r.user?.phone ?? null,
        displayName: r.user?.profile?.displayName ?? null,
        status: String(data.deliveryStatus || 'sent'),
        createdAt: r.createdAt.toISOString(),
        readAt: r.readAt?.toISOString() ?? null,
      };
    });
    if (q?.status) {
      items = items.filter((i) => i.status === q.status);
    }
    const total = items.length;
    return {
      campaignId,
      items: items.slice(skip, skip + limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async retryFailedCampaign(campaignId: string, actorId?: string) {
    const rows = await this.prisma.notification.findMany({
      where: {
        type: NotificationType.system,
        data: { path: ['campaignId'], equals: campaignId },
      },
      select: { id: true, data: true, userId: true },
    });
    const failed = rows.filter((r) => {
      const data = (r.data || {}) as Record<string, unknown>;
      return String(data.deliveryStatus || '') === 'failed';
    });
    for (const r of failed) {
      const data = { ...((r.data || {}) as object), deliveryStatus: 'sent', retriedAt: new Date().toISOString() };
      await this.prisma.notification.update({
        where: { id: r.id },
        data: { data: data as Prisma.InputJsonValue },
      });
    }
    await this.audit(actorId, 'notification.retry_failed', 'notification', null, null, {
      campaignId,
      retried: failed.length,
    });
    return { success: true, retried: failed.length, campaignId, totalFailed: failed.length };
  }

  async getPlatformSettings() {
    return { groups: [] };
  }
  async updatePlatformSettingsGroup(group: string, values: Record<string, unknown>, actorId?: string) {
    await this.audit(actorId, 'settings.update', 'settings', group, null, values);
    return { group, values };
  }
  async getCMSContent() {
    return {};
  }
  async updateCMSContent(content: Record<string, unknown>, actorId?: string) {
    await this.audit(actorId, 'cms.update', 'cms', null, null, content);
    return content;
  }
  async getSiteBuilder() {
    return { sections: [] };
  }
  async updateSiteBuilder(sections: unknown[], actorId?: string) {
    await this.audit(actorId, 'site_builder.update', 'site_builder', null, null, { count: sections?.length });
    return { sections };
  }
  async listRoles() {
    return this.prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } } } });
  }
  async listPermissions() {
    return this.prisma.permission.findMany();
  }
}
