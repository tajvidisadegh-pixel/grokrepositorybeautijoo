import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../storage/storage.provider';
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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}
  private readonly logger = new Logger(AdminService.name);

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
    const pendingProfessionals = await this.prisma.professional.count({
      where: { status: ProfessionalStatus.pending_review },
    });
    return {
      overview: {
        totalUsers: await this.prisma.user.count(),
        totalProfessionals: await this.prisma.professional.count(),
        pendingProfessionals,
        totalBookings: await this.prisma.booking.count(),
        completedBookings: 0,
        cancelledBookings: 0,
        totalReviews: await this.prisma.review.count(),
        revenue: { available: true, total: 0 },
      },
      timeStats: { today: {}, last7Days: {}, last30Days: {}, thisMonth: {} },
      trends: { userGrowth: [], professionalGrowth: [], bookingActivity: [], revenue: null },
      pending: { professionalsAwaitingReview: pendingProfessionals, pendingPayments: 0, failedPayments: 0 },
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

  async listUsers(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = { accountType: (q.accountType || 'customer') as any };
    if (q.status) {
      const s = String(q.status).toLowerCase();
      where.status = (s === 'blocked' ? UserStatus.suspended : s) as UserStatus;
    }
    if (q.search) {
      const s = String(q.search).trim();
      where.OR = [
        { phone: { contains: s } },
        { profile: { displayName: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { profile: true, userRoles: { include: { role: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map((u) => ({
        id: u.id, phone: u.phone, email: u.email, status: u.status,
        accountType: u.accountType, createdAt: u.createdAt, profile: u.profile,
        roles: u.userRoles.map((ur) => ur.role.name),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async getCustomersStats() {
    const base = { accountType: 'customer' as const };
    const [total, active, suspended, inactive, withBookings, neverBooked] = await Promise.all([
      this.prisma.user.count({ where: base }),
      this.prisma.user.count({ where: { ...base, status: UserStatus.active } }),
      this.prisma.user.count({ where: { ...base, status: UserStatus.suspended } }),
      this.prisma.user.count({ where: { ...base, status: UserStatus.inactive } }),
      this.prisma.user.count({ where: { ...base, bookingsAsCustomer: { some: {} } } }),
      this.prisma.user.count({ where: { ...base, bookingsAsCustomer: { none: {} } } }),
    ]);
    return { total, active, suspended, inactive, withBookings, neverBooked };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return { ...user, roles: user.userRoles.map((ur) => ur.role.name), stats: {}, bookings: [], reviews: [], auditLogs: [] };
  }

  async setUserStatus(id: string, status: UserStatus | string, actorId?: string, reason?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    const raw = String(status || '').toLowerCase().trim();
    const mapped: UserStatus =
      raw === 'blocked' || raw === 'suspended' ? UserStatus.suspended
        : raw === 'inactive' ? UserStatus.inactive
          : raw === 'deleted' ? UserStatus.deleted : UserStatus.active;
    const updated = await this.prisma.user.update({ where: { id }, data: { status: mapped } });
    userAuthCache.invalidate(id);
    await this.audit(actorId, 'user.status_change', 'user', id, { status: existing.status }, { status: mapped, reason });
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
    return this.getUserDetail(id);
  }

  async createCustomer(dto: { phone: string; displayName?: string; firstName?: string; lastName?: string }, actorId?: string) {
    const phone = String(dto.phone || '').trim();
    if (!phone) throw new BadRequestException('phone is required');
    const existing = await this.prisma.user.findFirst({ where: { phone, accountType: 'customer' } });
    if (existing) throw new BadRequestException('User with this phone already exists');
    const user = await this.prisma.user.create({
      data: {
        phone, accountType: 'customer', status: UserStatus.active,
        profile: { create: { displayName: (dto.displayName || dto.firstName || phone).trim(), firstName: dto.firstName?.trim() || null, lastName: dto.lastName?.trim() || null } },
      },
      include: { profile: true },
    });
    await this.audit(actorId, 'user.create', 'user', user.id, null, { phone });
    return this.getUserDetail(user.id);
  }

  async updateUserProfile(id: string, dto: { displayName?: string; firstName?: string; lastName?: string; phone?: string }, actorId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: { profile: true } });
    if (!existing) throw new NotFoundException('User not found');
    if (dto.phone !== undefined) {
      const phone = String(dto.phone).trim();
      if (phone) await this.prisma.user.update({ where: { id }, data: { phone } });
    }
    if (existing.profile) {
      await this.prisma.profile.update({
        where: { userId: id },
        data: {
          ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
          ...(dto.firstName !== undefined ? { firstName: dto.firstName?.trim() || null } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName?.trim() || null } : {}),
        },
      });
    }
    userAuthCache.invalidate(id);
    return this.getUserDetail(id);
  }

  async hardDeleteUser(id: string, actorId?: string, reason?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.accountType !== 'customer') throw new BadRequestException('فقط حساب مشتری');
    await this.prisma.$transaction(async (tx) => {
      const bookings = await tx.booking.findMany({ where: { customerId: id }, select: { id: true } });
      const bookingIds = bookings.map((b) => b.id);
      if (bookingIds.length) {
        await tx.payment.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.bookingItem.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.review.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }
      await tx.review.deleteMany({ where: { customerId: id } });
      await tx.favorite.deleteMany({ where: { userId: id } });
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.refreshToken.deleteMany({ where: { userId: id } });
      await tx.otpCode.deleteMany({ where: { userId: id } });
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.profile.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });
    userAuthCache.invalidate(id);
    await this.audit(actorId, 'user.hard_delete', 'user', id, { phone: existing.phone }, { reason });
    return { success: true, id };
  }

  async bulkHardDeleteUsers(userIds: string[], actorId?: string, reason?: string) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean)));
    if (!ids.length) throw new BadRequestException('empty');
    let deleted = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try { await this.hardDeleteUser(id, actorId, reason); deleted += 1; }
      catch { failed.push(id); }
    }
    return { success: true, deleted, failed, requested: ids.length };
  }

  async softDeleteUser(id: string, actorId?: string, reason?: string) {
    return this.hardDeleteUser(id, actorId, reason);
  }

  async listProfessionals(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.ProfessionalWhereInput = {};
    if (q.status) where.status = q.status;
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { include: { profile: true } } } }),
      this.prisma.professional.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async getProfessionalsReviewQueue() {
    const [pendingProfessionals, pendingMedia, draftProfessionals, suspendedProfessionals] = await Promise.all([
      this.prisma.professional.count({ where: { status: ProfessionalStatus.pending_review } }),
      this.prisma.mediaAsset.count({ where: { status: MediaStatus.draft } }),
      this.prisma.professional.count({ where: { status: ProfessionalStatus.draft } }),
      this.prisma.professional.count({ where: { status: ProfessionalStatus.suspended } }),
    ]);
    return { pendingProfessionals, pendingMedia, incompleteProfiles: 0, draftProfessionals, suspendedProfessionals };
  }

  async getProfessionalDetail(id: string) {
    const pro = await this.prisma.professional.findUnique({
      where: { id },
      include: { user: { include: { profile: true } }, professionalServices: true, mediaAssets: true },
    });
    if (!pro) throw new NotFoundException('Professional not found');
    return pro;
  }

  async updateProfessional(id: string, data: any, actorId?: string) {
    const existing = await this.prisma.professional.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Professional not found');
    const updated = await this.prisma.professional.update({ where: { id }, data });
    await this.audit(actorId, 'professional.update', 'professional', id, existing, updated);
    return this.getProfessionalDetail(id);
  }

  async setProfessionalStatus(id: string, status: ProfessionalStatus, actorId?: string, reason?: string) {
    const existing = await this.prisma.professional.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Professional not found');
    const updated = await this.prisma.professional.update({ where: { id }, data: { status } });
    await this.audit(actorId, 'professional.status_change', 'professional', id, { status: existing.status }, { status, reason });
    return updated;
  }

  async setProfessionalFeatured(id: string, isFeatured: boolean, actorId?: string) {
    const updated = await this.prisma.professional.update({ where: { id }, data: { isFeatured } });
    await this.audit(actorId, 'professional.feature', 'professional', id, null, { isFeatured });
    return updated;
  }

  async getBookingsStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [total, today, pending, completed, cancelled, paidAgg, failedPayments] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { startAt: { gte: startOfToday } } }),
      this.prisma.booking.count({ where: { status: BookingStatus.pending } }),
      this.prisma.booking.count({ where: { status: BookingStatus.completed } }),
      this.prisma.booking.count({ where: { status: BookingStatus.cancelled } }),
      this.prisma.payment.aggregate({ where: { status: PaymentStatus.paid }, _sum: { amount: true } }),
      this.prisma.payment.count({ where: { status: { in: [PaymentStatus.failed, PaymentStatus.cancelled] } } }),
    ]);
    const grossRevenue = Number(paidAgg._sum.amount || 0);
    const commissionRate = DEFAULT_PLATFORM_COMMISSION_RATE;
    const platformShare = Math.round((grossRevenue * commissionRate) / 100);
    return { total, today, pending, completed, cancelled, grossRevenue, platformShare, commissionRate, failedPayments };
  }

  async listBookings(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.BookingWhereInput = {};
    if (q.status) where.status = q.status as BookingStatus;
    if (q.startDate || q.endDate) {
      where.startAt = {};
      if (q.startDate) (where.startAt as any).gte = new Date(q.startDate);
      if (q.endDate) (where.startAt as any).lte = new Date(String(q.endDate) + 'T23:59:59.999Z');
    }
    if (q.paymentStatus) where.payment = { status: q.paymentStatus as PaymentStatus };
    if (q.search) {
      const s = String(q.search).trim();
      const or: Prisma.BookingWhereInput[] = [
        { customer: { phone: { contains: s } } },
        { customer: { profile: { displayName: { contains: s, mode: 'insensitive' } } } },
        { professional: { title: { contains: s, mode: 'insensitive' } } },
        { professional: { user: { phone: { contains: s } } } },
        { professional: { user: { profile: { displayName: { contains: s, mode: 'insensitive' } } } } },
      ];
      if (/^[0-9a-fA-F-]{8,36}$/.test(s)) {
        or.unshift({ id: s });
      }
      where.OR = or;
    }
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where, skip, take: limit, orderBy: { startAt: 'desc' },
        include: {
          customer: { include: { profile: true } },
          professional: { include: { user: { include: { profile: true } } } },
          payment: true,
          items: true,
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
        items: true,
      },
    });
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }

  async updateBookingStatus(id: string, status: BookingStatus, actorId?: string, reason?: string) {
    const existing = await this.prisma.booking.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Booking not found');
    const updated = await this.prisma.booking.update({ where: { id }, data: { status } });
    await this.audit(actorId, 'booking.status_change', 'booking', id, { status: existing.status }, { status, reason });
    return this.getBookingDetail(id);
  }

  async listReviews(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.ReviewWhereInput = {};
    if (q.rating) where.rating = Number(q.rating);
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          customer: { include: { profile: true } },
          professional: { include: { user: { include: { profile: true } } } },
          booking: true,
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async listNotifications(_q?: any) {
    return { items: [], meta: { page: 1, limit: 30, total: 0, totalPages: 0 } };
  }

  async notifyUsers(
    dto: { userIds: string[]; title: string; body: string; sms?: boolean; campaignId?: string },
    actorId?: string,
  ) {
    const campaignId = dto.campaignId || `camp_${Date.now()}`;
    let notified = 0;
    for (const userId of Array.from(new Set(dto.userIds || []))) {
      try {
        await this.prisma.notification.create({
          data: {
            userId,
            type: NotificationType.system,
            title: dto.title,
            body: dto.body,
            data: { campaignId, sms: !!dto.sms } as Prisma.InputJsonValue,
          },
        });
        notified += 1;
      } catch {
        /* skip */
      }
    }
    await this.audit(actorId, 'notification.notify', 'notification', campaignId, null, { notified, campaignId });
    return { success: true, notified, smsSent: 0, campaignId, failed: (dto.userIds || []).length - notified };
  }

  async notifyByFilter(
    dto: { title: string; body: string; sms?: boolean; limit?: number; filters?: Record<string, unknown> },
    actorId?: string,
  ) {
    const limit = Math.min(500, Math.max(1, Number(dto.limit) || 100));
    const filters = dto.filters || {};
    const where: Prisma.UserWhereInput = { status: UserStatus.active };
    if (filters.accountType) where.accountType = filters.accountType as any;
    else where.accountType = 'customer' as any;
    const users = await this.prisma.user.findMany({ where, take: limit, select: { id: true } });
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

  private static readonly CMS_DRAFT_KEY = 'site.cms.draft';
  private static readonly CMS_PUBLISHED_KEY = 'site.cms.published';
  private static readonly BUILDER_DRAFT_KEY = 'site.builder.draft';
  private static readonly BUILDER_PUBLISHED_KEY = 'site.builder.published';

  private defaultSections() {
    return [
      { id: 'hero', label: 'Hero', enabled: true, sortOrder: 0 },
      { id: 'categories', label: 'دسته‌بندی‌های محبوب', enabled: true, sortOrder: 1 },
      { id: 'featured', label: 'زیباگرهای برتر', enabled: true, sortOrder: 2 },
      { id: 'cta', label: 'دعوت به اقدام', enabled: true, sortOrder: 3 },
    ];
  }

  private async getSettingJson(key: string, fallback: any) {
    try {
      const row = await this.prisma.platformSetting.findUnique({ where: { key } });
      if (!row?.value) return fallback;
      return typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    } catch {
      return fallback;
    }
  }

  private async setSettingJson(key: string, value: any) {
    const str = JSON.stringify(value);
    await this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: str },
      update: { value: str },
    });
  }

  async getSiteCmsContent() {
    const draft = await this.getSettingJson(AdminService.CMS_DRAFT_KEY, {});
    const published = await this.getSettingJson(AdminService.CMS_PUBLISHED_KEY, null);
    const hasUnpublishedChanges =
      JSON.stringify(draft) !== JSON.stringify(published || {});
    return { draft, published, hasUnpublishedChanges };
  }

  async putSiteCmsContent(body: any, actorId?: string) {
    const next = {
      hero: body?.hero || {},
      texts: body?.texts || {},
      features: body?.features || {},
      updatedAt: new Date().toISOString(),
    };
    await this.setSettingJson(AdminService.CMS_DRAFT_KEY, next);
    await this.audit(actorId, 'site_cms.draft_save', 'platform_setting', AdminService.CMS_DRAFT_KEY, null, next);
    return { draft: next, published: await this.getSettingJson(AdminService.CMS_PUBLISHED_KEY, null) };
  }

  async getSiteBuilder() {
    const draftSections = await this.getSettingJson(AdminService.BUILDER_DRAFT_KEY, this.defaultSections());
    const publishedSections = await this.getSettingJson(AdminService.BUILDER_PUBLISHED_KEY, null);
    return {
      draft: { sections: draftSections },
      published: publishedSections ? { sections: publishedSections } : null,
      hasUnpublishedChanges: JSON.stringify(draftSections) !== JSON.stringify(publishedSections || []),
    };
  }

  async putSiteBuilder(sections: any[], actorId?: string) {
    const normalized = (Array.isArray(sections) ? sections : this.defaultSections()).map((s: any, i: number) => ({
      id: String(s.id),
      label: String(s.label || s.id),
      enabled: s.enabled !== false,
      sortOrder: typeof s.sortOrder === 'number' ? s.sortOrder : i,
    }));
    await this.setSettingJson(AdminService.BUILDER_DRAFT_KEY, normalized);
    await this.audit(actorId, 'site_builder.draft_save', 'platform_setting', AdminService.BUILDER_DRAFT_KEY, null, normalized);
    return { sections: normalized };
  }

  async publishSiteCms(actorId?: string) {
    const contentToPublish = await this.getSettingJson(AdminService.CMS_DRAFT_KEY, {});
    const draftSections = await this.getSettingJson(AdminService.BUILDER_DRAFT_KEY, this.defaultSections());
    const publishedAt = new Date().toISOString();
    contentToPublish.publishedAt = publishedAt;
    contentToPublish.updatedAt = publishedAt;
    await this.setSettingJson(AdminService.CMS_PUBLISHED_KEY, contentToPublish);
    await this.setSettingJson(AdminService.CMS_DRAFT_KEY, contentToPublish);
    await this.setSettingJson(AdminService.BUILDER_PUBLISHED_KEY, draftSections);
    await this.setSettingJson(AdminService.BUILDER_DRAFT_KEY, draftSections);
    await this.audit(actorId, 'site_cms.publish', 'platform_setting', AdminService.CMS_PUBLISHED_KEY, null, {
      publishedAt,
    });
    return { success: true, publishedAt, content: contentToPublish, sections: draftSections };
  }

  async getPublishedSiteConfig() {
    const content = await this.getSettingJson(AdminService.CMS_PUBLISHED_KEY, {});
    const sections = await this.getSettingJson(AdminService.BUILDER_PUBLISHED_KEY, this.defaultSections());
    return { content, sections };
  }

  async uploadSiteCmsImage(
    file: { buffer?: Buffer; path?: string; mimetype: string; originalname: string; size: number },
    slot?: string,
  ) {
    const fs = await import('fs');
    let raw: Buffer;
    if (file.buffer) raw = file.buffer;
    else if (file.path) raw = fs.readFileSync(file.path);
    else throw new BadRequestException('No file data');
    const mime = String(file.mimetype || 'image/jpeg');
    if (!mime.startsWith('image/')) throw new BadRequestException('Only images allowed');
    const ext =
      mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg';
    const { randomBytes } = await import('crypto');
    const slotSafe = String(slot || 'generic').replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'generic';
    const key = `site-cms/${slotSafe}/${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
    const storedKey = await this.storage.upload(key, raw, mime.startsWith('image/') ? mime : `image/${ext}`);
    const url = this.storage.getPublicUrl ? this.storage.getPublicUrl(storedKey) : storedKey;
    return { publicUrl: url, url, storageKey: storedKey, key: storedKey, slot: slotSafe };
  }

  async listAuditLogs(q?: any) {
    const page = Math.max(1, Number(q?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q?.limit) || 30));
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.count(),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async assignServiceFilterCategory(serviceId: string, categoryId: string, _actorId?: string) {
    return this.prisma.service.update({ where: { id: serviceId }, data: { categoryId } });
  }
}
