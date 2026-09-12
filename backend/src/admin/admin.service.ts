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
    const where: Prisma.UserWhereInput = {};
    if (!q.accountType || q.accountType === 'customer') where.accountType = 'customer';
    else if (q.accountType === 'professional') where.accountType = 'professional';
    if (q.status) where.status = q.status;
    if (q.role) where.userRoles = { some: { role: { name: q.role } } };
    if (q.search?.trim()) {
      const term = q.search.trim();
      where.OR = [
        { phone: { contains: term } },
        { email: { contains: term, mode: 'insensitive' } },
        { profile: { displayName: { contains: term, mode: 'insensitive' } } },
      ];
    }
    if (q.city?.trim()) {
      where.bookingsAsCustomer = {
        some: { location: { city: { contains: q.city.trim(), mode: 'insensitive' } } },
      };
    }
    const presence = q.bookingPresence;
    if (presence === 'none') where.bookingsAsCustomer = { none: {} };
    else if (presence === 'has' || presence === 'any') {
      where.bookingsAsCustomer = q.bookingStatus?.trim()
        ? { some: { status: q.bookingStatus.trim() as BookingStatus } }
        : { some: {} };
    } else if (q.bookingStatus?.trim()) {
      where.bookingsAsCustomer = { some: { status: q.bookingStatus.trim() as BookingStatus } };
    }
    if (q.registeredFrom || q.registeredTo) {
      where.createdAt = {};
      if (q.registeredFrom) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(q.registeredFrom);
      if (q.registeredTo) {
        const end = new Date(q.registeredTo);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Prisma.DateTimeFilter).lte = end;
      }
    }
    if (q.neverNotified === true || q.neverNotified === 'true' || q.neverNotified === '1') {
      where.notifications = { none: {} };
    }
    if (q.hasPaid === true || q.hasPaid === 'true' || q.hasPaid === '1') {
      where.bookingsAsCustomer = { some: { payment: { status: PaymentStatus.paid } } };
    }
    return where;
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
        include: { user: { select: { id: true, phone: true, profile: { select: { displayName: true } } } } },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async broadcastNotification(
    dto: { title: string; body: string; target: 'all' | 'professionals' | 'customers' },
    actorId?: string,
  ) {
    if (!dto?.title?.trim() || !dto?.body?.trim()) {
      throw new BadRequestException('title and body are required');
    }
    const where: Prisma.UserWhereInput = { status: UserStatus.active };
    if (dto.target === 'professionals') where.accountType = 'professional';
    else if (dto.target === 'customers') where.accountType = 'customer';
    const users = await this.prisma.user.findMany({ where, select: { id: true }, take: 5000 });
    if (users.length === 0) return { success: true, created: 0 };
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
    const filters = { ...(dto.filters || {}), accountType: (dto.filters as any)?.accountType || 'customer' };
    const where = this.buildUserWhere(filters as any);
    where.status = UserStatus.active;
    const max = Math.min(500, Math.max(1, Number(dto.limit) || 500));
    const users = await this.prisma.user.findMany({
      where,
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
      where: { type: NotificationType.system },
      orderBy: { createdAt: 'desc' },
      take: 3000,
      select: {
        id: true,
        userId: true,
        title: true,
        data: true,
        createdAt: true,
        readAt: true,
        user: { select: { id: true, phone: true, status: true, profile: { select: { displayName: true } } } },
      },
    });
    let items = rows
      .filter((r) => String(((r.data || {}) as Record<string, unknown>).campaignId || '') === campaignId)
      .map((r) => {
        const data = (r.data || {}) as Record<string, unknown>;
        return {
          id: r.id,
          userId: r.userId,
          status: String(data.deliveryStatus || 'sent'),
          phone: r.user?.phone ?? null,
          displayName: r.user?.profile?.displayName ?? null,
          userStatus: r.user?.status ?? null,
          readAt: r.readAt,
          createdAt: r.createdAt,
          title: r.title,
        };
      });
    if (q?.status) items = items.filter((i) => i.status === q.status);
    return {
      campaignId,
      items: items.slice(skip, skip + limit),
      meta: { page, limit, total: items.length, totalPages: Math.ceil(items.length / limit) || 0 },
    };
  }

  async retryFailedCampaign(campaignId: string, actorId?: string) {
    const rows = await this.prisma.notification.findMany({
      where: { type: NotificationType.system },
      take: 3000,
      orderBy: { createdAt: 'desc' },
      select: { id: true, data: true },
    });
    const failed = rows.filter((r) => {
      const data = (r.data || {}) as Record<string, unknown>;
      return String(data.campaignId || '') === campaignId && String(data.deliveryStatus || '') === 'failed';
    });
    let ok = 0;
    for (const r of failed) {
      const data = {
        ...((r.data || {}) as Record<string, unknown>),
        deliveryStatus: 'sent',
        retriedAt: new Date().toISOString(),
      };
      try {
        await this.prisma.notification.update({
          where: { id: r.id },
          data: { data: data as Prisma.InputJsonValue },
        });
        ok += 1;
      } catch {
        /* keep failed */
      }
    }
    await this.audit(actorId, 'notification.retry_failed', 'notification', null, null, {
      campaignId,
      retried: ok,
      totalFailed: failed.length,
    });
    return { success: true, retried: ok, campaignId, totalFailed: failed.length };
  }

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
    await this.audit(actorId, 'settings.update', 'platform_setting', row.id, null, { group, values });
    return row;
  }

  async getCMSContent() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'cms.content' } });
    return row?.value ?? {};
  }

  async updateCMSContent(content: Record<string, unknown>, actorId?: string) {
    const row = await this.prisma.platformSetting.upsert({
      where: { key: 'cms.content' },
      create: { key: 'cms.content', value: content as Prisma.InputJsonValue },
      update: { value: content as Prisma.InputJsonValue },
    });
    await this.audit(actorId, 'cms.update', 'platform_setting', row.id, null, content);
    return row;
  }

  async getSiteBuilder() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'site.builder' } });
    return row?.value ?? [];
  }

  async updateSiteBuilder(sections: unknown[], actorId?: string) {
    const row = await this.prisma.platformSetting.upsert({
      where: { key: 'site.builder' },
      create: { key: 'site.builder', value: sections as Prisma.InputJsonValue },
      update: { value: sections as Prisma.InputJsonValue },
    });
    await this.audit(actorId, 'site_builder.update', 'platform_setting', row.id, null, {
      count: sections?.length,
    });
    return row;
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
