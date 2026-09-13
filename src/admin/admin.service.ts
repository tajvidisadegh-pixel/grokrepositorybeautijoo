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
    const where: Prisma.UserWhereInput = {};
    if (q.accountType) where.accountType = String(q.accountType) as any;
    else where.accountType = 'customer' as any;
    if (q.status) {
      const s = String(q.status).toLowerCase();
      where.status = (s === 'blocked' ? UserStatus.suspended : s) as UserStatus;
    }
    if (q.search) {
      const s = String(q.search).trim();
      where.OR = [
        { phone: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
        { profile: { displayName: { contains: s, mode: 'insensitive' } } },
        { profile: { firstName: { contains: s, mode: 'insensitive' } } },
        { profile: { lastName: { contains: s, mode: 'insensitive' } } },
      ];
    }
    if (q.registeredFrom || q.registeredTo) {
      where.createdAt = {};
      if (q.registeredFrom) (where.createdAt as any).gte = new Date(q.registeredFrom);
      if (q.registeredTo) (where.createdAt as any).lte = new Date(String(q.registeredTo) + 'T23:59:59.999Z');
    }
    if (q.bookingPresence === 'has' || q.bookingStatus) {
      where.bookingsAsCustomer = {
        some: q.bookingStatus ? { status: String(q.bookingStatus) as any } : {},
      };
    } else if (q.bookingPresence === 'none') {
      where.bookingsAsCustomer = { none: {} };
    }
    if (q.hasPaid === true || q.hasPaid === 'true') {
      where.bookingsAsCustomer = {
        some: {
          ...((where.bookingsAsCustomer as any)?.some || {}),
          payment: { status: PaymentStatus.paid },
        },
      };
    }
    if (q.neverNotified === true || q.neverNotified === 'true') {
      where.notifications = { none: {} };
    }
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
          userRoles: { include: { role: true } },
          _count: { select: { bookingsAsCustomer: true, notifications: true } },
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
        profile: u.profile,
        roles: u.userRoles.map((ur) => ur.role.name),
        bookingCount: (u as any)._count?.bookingsAsCustomer ?? 0,
        notificationsCount: (u as any)._count?.notifications ?? 0,
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
      raw === 'blocked' || raw === 'suspended'
        ? UserStatus.suspended
        : raw === 'inactive'
          ? UserStatus.inactive
          : raw === 'deleted'
            ? UserStatus.deleted
            : UserStatus.active;
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
    await this.audit(actorId, 'user.roles_change', 'user', id, null, { roles: uniqueNames });
    return this.getUserDetail(id);
  }

  async createCustomer(
    dto: { phone: string; displayName?: string; firstName?: string; lastName?: string },
    actorId?: string,
  ) {
    const phone = String(dto.phone || '').trim();
    if (!phone) throw new BadRequestException('phone is required');
    const existing = await this.prisma.user.findFirst({ where: { phone, accountType: 'customer' } });
    if (existing) throw new BadRequestException('User with this phone already exists');
    const user = await this.prisma.user.create({
      data: {
        phone,
        accountType: 'customer',
        status: UserStatus.active,
        profile: {
          create: {
            displayName: (dto.displayName || dto.firstName || phone).trim(),
            firstName: dto.firstName?.trim() || null,
            lastName: dto.lastName?.trim() || null,
          },
        },
      },
      include: { profile: true },
    });
    await this.audit(actorId, 'user.create', 'user', user.id, null, { phone, accountType: 'customer' });
    return this.getUserDetail(user.id);
  }

  async updateUserProfile(
    id: string,
    dto: { displayName?: string; firstName?: string; lastName?: string; phone?: string },
    actorId?: string,
  ) {
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
    } else {
      await this.prisma.profile.create({
        data: {
          userId: id,
          displayName: (dto.displayName || dto.firstName || existing.phone || 'کاربر').trim(),
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
        },
      });
    }
    userAuthCache.invalidate(id);
    await this.audit(actorId, 'user.profile_update', 'user', id, null, dto);
    return this.getUserDetail(id);
  }

  async hardDeleteUser(id: string, actorId?: string, reason?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    if (existing.accountType !== 'customer') {
      throw new BadRequestException('فقط حساب مشتری از این مسیر قابل حذف کامل است');
    }
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
    await this.audit(actorId, 'user.hard_delete', 'user', id, { phone: existing.phone, status: existing.status }, { reason });
    return { success: true, id };
  }

  async bulkHardDeleteUsers(userIds: string[], actorId?: string, reason?: string) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean)));
    if (!ids.length) throw new BadRequestException('هیچ شناسه‌ای ارسال نشده');
    if (ids.length > 100) throw new BadRequestException('حداکثر ۱۰۰ مورد در هر درخواست');
    let deleted = 0;
    const failed: string[] = [];
    for (const id of ids) {
      try {
        await this.hardDeleteUser(id, actorId, reason);
        deleted += 1;
      } catch {
        failed.push(id);
      }
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

  async listBookings(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.BookingWhereInput = {};
    if (q.status) where.status = q.status;
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startAt: 'desc' },
        include: { customer: { include: { profile: true } }, professional: true },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async getBookingDetail(id: string) {
    const b = await this.prisma.booking.findUnique({
      where: { id },
      include: { customer: { include: { profile: true } }, professional: true, payment: true, items: true },
    });
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }

  async updateBookingStatus(id: string, status: BookingStatus, actorId?: string, reason?: string) {
    const existing = await this.prisma.booking.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Booking not found');
    const updated = await this.prisma.booking.update({ where: { id }, data: { status } });
    await this.audit(actorId, 'booking.status_change', 'booking', id, { status: existing.status }, { status, reason });
    return updated;
  }

  async listReviews(_q?: any) {
    return { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }
  async setReviewVisibility(id: string, isPublished: boolean, actorId?: string, reason?: string) {
    return { id, isPublished, actorId, reason };
  }
  async deleteReview(id: string, actorId?: string) {
    await this.audit(actorId, 'review.delete', 'review', id, null, null);
    return { success: true };
  }

  async listMedia(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 24));
    const skip = (page - 1) * limit;
    const where: Prisma.MediaAssetWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.kind) where.kind = q.kind;
    if (q.professionalId) where.professionalId = q.professionalId;
    const [items, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async setMediaStatus(id: string, status: MediaStatus, actorId?: string) {
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Media not found');
    const updated = await this.prisma.mediaAsset.update({ where: { id }, data: { status } });
    await this.audit(actorId, 'media.status_change', 'media', id, { status: existing.status }, { status });
    return updated;
  }

  async deleteMedia(id: string, actorId?: string) {
    await this.prisma.mediaAsset.delete({ where: { id } }).catch(() => null);
    await this.audit(actorId, 'media.delete', 'media', id, null, null);
    return { success: true };
  }

  async listAuditLogs(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 50));
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.count(),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async listNotifications(_q?: any) {
    return { items: [], meta: { page: 1, limit: 30, total: 0, totalPages: 0 } };
  }

  async broadcastNotification(dto: any, actorId?: string) {
    await this.audit(actorId, 'notification.broadcast', 'notification', null, null, dto);
    return { success: true, target: dto?.target };
  }

  async getPlatformSettings() {
    return {};
  }
  async updatePlatformSettingsGroup(group: string, values: Record<string, any>, actorId?: string) {
    await this.audit(actorId, 'settings.update', 'settings', group, null, values);
    return { group, values };
  }
  async getCMSContent() {
    return { draft: {}, published: null, hasUnpublishedChanges: false };
  }
  async updateCMSContent(content: Record<string, any>, actorId?: string) {
    await this.audit(actorId, 'cms.update', 'cms', null, null, content);
    return content;
  }
  async getSiteBuilder() {
    return { draft: { sections: [] }, published: null, hasUnpublishedChanges: false };
  }
  async updateSiteBuilder(sections: any[], actorId?: string) {
    await this.audit(actorId, 'site_builder.update', 'site_builder', null, null, sections);
    return { sections };
  }
  async listRoles() {
    return this.prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } } } });
  }
  async listPermissions() {
    return this.prisma.permission.findMany();
  }

  async notifyUsers(dto: { userIds: string[]; title: string; body: string; sms?: boolean; campaignId?: string }, actorId?: string) {
    const campaignId = dto.campaignId || `camp_${Date.now()}`;
    const uniqueIds = Array.from(new Set((dto.userIds || []).filter(Boolean)));
    let notified = 0;
    for (const userId of uniqueIds) {
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
    return { success: true, notified, smsSent: 0, campaignId, failed: uniqueIds.length - notified };
  }

  async notifyByFilter(dto: { title: string; body: string; sms?: boolean; limit?: number; filters?: Record<string, unknown> }, actorId?: string) {
    const limit = Math.min(500, Math.max(1, Number(dto.limit) || 100));
    const filters = dto.filters || {};
    const where: Prisma.UserWhereInput = {};
    if (filters.accountType) where.accountType = String(filters.accountType) as any;
    if (filters.status) {
      const s = String(filters.status);
      where.status = (s === 'blocked' ? UserStatus.suspended : s) as UserStatus;
    }
    const users = await this.prisma.user.findMany({ where, take: limit, select: { id: true }, orderBy: { createdAt: 'desc' } });
    return this.notifyUsers({ userIds: users.map((u) => u.id), title: dto.title, body: dto.body, sms: dto.sms }, actorId);
  }

  async listNotificationCampaigns(q: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    return { items: [], meta: { page, limit, total: 0, totalPages: 0 } };
  }

  async getCampaignRecipients(campaignId: string, opts?: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(opts?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts?.limit) || 50));
    return { campaignId, items: [], meta: { page, limit, total: 0, totalPages: 0 } };
  }

  async retryFailedCampaign(campaignId: string, actorId?: string) {
    await this.audit(actorId, 'notification.retry_failed', 'notification', campaignId, null, null);
    return { success: true, retried: 0, campaignId, totalFailed: 0 };
  }

  async listServiceCategories() {
    return this.prisma.serviceCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { children: true, _count: { select: { services: true } } },
    });
  }

  async createServiceCategory(dto: any, actorId?: string) {
    const slug = dto.slug?.trim() || dto.name.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
    const created = await this.prisma.serviceCategory.create({
      data: {
        name: dto.name.trim(),
        slug,
        parentId: dto.parentId || null,
        description: dto.description || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit(actorId, 'catalog.category.create', 'service_category', created.id, null, created);
    return created;
  }

  async updateServiceCategory(id: string, dto: any, actorId?: string) {
    const existing = await this.prisma.serviceCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');
    const updated = await this.prisma.serviceCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit(actorId, 'catalog.category.update', 'service_category', id, existing, updated);
    return updated;
  }

  async deleteServiceCategory(id: string, actorId?: string) {
    const existing = await this.prisma.serviceCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');
    await this.prisma.serviceCategory.delete({ where: { id } });
    await this.audit(actorId, 'catalog.category.delete', 'service_category', id, existing, null);
    return { success: true };
  }

  async listCatalogServices() {
    return this.prisma.service.findMany({ include: { category: true }, orderBy: { name: 'asc' } });
  }

  async createCatalogService(dto: any, actorId?: string) {
    const slug = dto.slug?.trim() || dto.name.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now().toString(36);
    const created = await this.prisma.service.create({
      data: {
        name: dto.name.trim(),
        categoryId: dto.categoryId,
        slug,
        description: dto.description || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit(actorId, 'catalog.service.create', 'service', created.id, null, created);
    return created;
  }

  async updateCatalogService(id: string, dto: any, actorId?: string) {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service not found');
    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit(actorId, 'catalog.service.update', 'service', id, existing, updated);
    return updated;
  }

  async deleteCatalogService(id: string, actorId?: string) {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service not found');
    await this.prisma.service.delete({ where: { id } });
    await this.audit(actorId, 'catalog.service.delete', 'service', id, existing, null);
    return { success: true };
  }

  async listServiceCategoryRequests(_status?: string) {
    return [];
  }

  async reviewServiceCategoryRequest(
    professionalServiceId: string,
    categoryId: string,
    status: string,
    actorId?: string,
  ) {
    await this.audit(actorId, 'catalog.request.review', 'professional_service', professionalServiceId, null, {
      categoryId,
      status,
    });
    return { professionalServiceId, categoryId, status };
  }

  async assignServiceFilterCategory(serviceId: string, categoryId: string, actorId?: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('Service not found');
    const updated = await this.prisma.service.update({ where: { id: serviceId }, data: { categoryId } });
    await this.audit(actorId, 'catalog.service.assign_category', 'service', serviceId, service, updated);
    return updated;
  }
}
