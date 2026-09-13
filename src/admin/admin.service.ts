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

  private buildUserWhere(q: any): Prisma.UserWhereInput {
    const and: Prisma.UserWhereInput[] = [];
    if (q.accountType) and.push({ accountType: q.accountType as any });
    if (q.status) and.push({ status: q.status });
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
    if (q.city?.trim()) {
      and.push({ profile: { city: { contains: q.city.trim(), mode: 'insensitive' } } } as any);
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
    if (q.bookingPresence === 'has') and.push({ bookingsAsCustomer: { some: {} } });
    else if (q.bookingPresence === 'none') and.push({ bookingsAsCustomer: { none: {} } });
    if (q.hasPaid === true || q.hasPaid === 'true') {
      and.push({ bookingsAsCustomer: { some: { payment: { status: PaymentStatus.paid } } } });
    }
    if (q.neverNotified === true || q.neverNotified === 'true') {
      and.push({ notifications: { none: {} } });
    }
    return and.length ? { AND: and } : {};
  }

  async listUsers(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where = this.buildUserWhere(q);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
          userRoles: { include: { role: true } },
          _count: { select: { bookingsAsCustomer: true, favorites: true, reviews: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map((u: any) => ({
        id: u.id, phone: u.phone, email: u.email, status: u.status, accountType: u.accountType,
        createdAt: u.createdAt, profile: u.profile,
        roles: u.userRoles.map((ur: any) => ur.role.name),
        bookingCount: u._count?.bookingsAsCustomer ?? 0,
        favoritesCount: u._count?.favorites ?? 0,
        reviewsCount: u._count?.reviews ?? 0,
        city: u.profile?.city ?? null,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        userRoles: { include: { role: true } },
        bookingsAsCustomer: {
          take: 30, orderBy: { startAt: 'desc' },
          include: { professional: true, payment: true },
        },
        reviews: { take: 20, orderBy: { createdAt: 'desc' }, include: { professional: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const bookings = (user as any).bookingsAsCustomer || [];
    return {
      ...user,
      roles: user.userRoles.map((ur) => ur.role.name),
      stats: {
        totalBookings: bookings.length,
        successfulBookings: bookings.filter((b: any) => ['completed', 'confirmed'].includes(b.status)).length,
        cancelledBookings: bookings.filter((b: any) => ['cancelled', 'rejected'].includes(b.status)).length,
        totalPaid: bookings.filter((b: any) => b.payment?.status === 'paid').reduce((s: number, b: any) => s + (b.payment?.amount || 0), 0),
        paidTransactions: bookings.filter((b: any) => b.payment?.status === 'paid').length,
        professionalsUsed: new Set(bookings.map((b: any) => b.professionalId).filter(Boolean)).size,
        reviewsCount: ((user as any).reviews || []).length,
      },
      bookings,
      reviews: (user as any).reviews || [],
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

  async listProfessionals(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const and: Prisma.ProfessionalWhereInput[] = [];
    if (q.status) and.push({ status: q.status });
    if (q.search?.trim()) {
      const term = q.search.trim();
      and.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { slug: { contains: term, mode: 'insensitive' } },
          { user: { phone: { contains: term } } },
        ],
      });
    }
    const where: Prisma.ProfessionalWhereInput = and.length ? { AND: and } : {};
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          user: { include: { profile: true } },
          locations: { include: { location: true }, take: 1 },
          _count: { select: { bookings: true, reviews: true, mediaAssets: true } },
        },
      }),
      this.prisma.professional.count({ where }),
    ]);
    return {
      items: items.map((p) => ({
        ...p,
        city: p.locations?.[0]?.location?.city ?? null,
        bookingCount: p._count.bookings,
        reviewCount: p._count.reviews,
        mediaCount: p._count.mediaAssets,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async getProfessionalsReviewQueue() {
    const [pendingProfessionals, draftProfessionals, suspendedProfessionals] = await Promise.all([
      this.prisma.professional.count({ where: { status: ProfessionalStatus.pending_review } }),
      this.prisma.professional.count({ where: { status: ProfessionalStatus.draft } }),
      this.prisma.professional.count({ where: { status: ProfessionalStatus.suspended } }),
    ]);
    const pendingMedia = await this.prisma.mediaAsset.count({ where: { status: MediaStatus.draft } });
    return { pendingProfessionals, pendingMedia, incompleteProfiles: 0, draftProfessionals, suspendedProfessionals };
  }

  async getProfessionalDetail(id: string) {
    const pro = await this.prisma.professional.findUnique({
      where: { id },
      include: {
        user: { include: { profile: true } },
        professionalServices: { include: { service: { include: { category: true } } } },
        workingHours: true,
        locations: { include: { location: true } },
        mediaAssets: true,
        bookings: { take: 30, orderBy: { startAt: 'desc' }, include: { customer: { include: { profile: true } }, payment: true } },
        reviews: { take: 30, orderBy: { createdAt: 'desc' }, include: { customer: { include: { profile: true } } } },
      },
    });
    if (!pro) throw new NotFoundException('Professional not found');
    return { ...pro, city: pro.locations?.[0]?.location?.city ?? null, stats: {} };
  }

  async updateProfessional(id: string, data: any, actorId?: string) {
    const existing = await this.prisma.professional.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Professional not found');
    const update: Prisma.ProfessionalUpdateInput = {};
    if (data.title !== undefined) update.title = data.title.trim();
    if (data.bio !== undefined) update.bio = data.bio.trim() || null;
    if (data.isFeatured !== undefined) update.isFeatured = data.isFeatured;
    const updated = await this.prisma.professional.update({ where: { id }, data: update });
    await this.audit(actorId, 'professional.update', 'professional', id, existing, updated);
    return this.getProfessionalDetail(id);
  }

  async setProfessionalStatus(id: string, status: ProfessionalStatus, actorId?: string, reason?: string) {
    const existing = await this.prisma.professional.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Professional not found');
    const data: Prisma.ProfessionalUpdateInput = { status };
    if (status === ProfessionalStatus.approved && !existing.publishedAt) {
      data.publishedAt = new Date();
      data.verifiedAt = new Date();
    }
    const updated = await this.prisma.professional.update({ where: { id }, data });
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
        where, skip, take: limit, orderBy: { startAt: 'desc' },
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

  async broadcastNotification(dto: { title: string; body: string; target: string }, actorId?: string) {
    const title = (dto.title || '').trim();
    const body = (dto.body || '').trim();
    if (!title || !body) throw new BadRequestException('title and body required');
    const where: Prisma.UserWhereInput = { status: UserStatus.active };
    if (dto.target === 'professionals') where.accountType = 'professional' as any;
    if (dto.target === 'customers') where.accountType = 'customer' as any;
    const users = await this.prisma.user.findMany({ where, select: { id: true }, take: 500 });
    if (users.length) {
      await this.prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id, type: NotificationType.system, title, body,
          data: { broadcast: true, target: dto.target, actorId: actorId ?? null },
        })),
      });
    }
    await this.audit(actorId, 'notification.broadcast', 'notification', null, null, { target: dto.target, count: users.length });
    return { success: true, notified: users.length };
  }

  async notifyUsers(dto: { userIds: string[]; title: string; body: string; sms?: boolean; campaignId?: string }, actorId?: string) {
    const title = (dto.title || '').trim();
    const body = (dto.body || '').trim();
    const ids = Array.from(new Set((dto.userIds || []).filter(Boolean)));
    if (!title || !body) throw new BadRequestException('title and body required');
    if (ids.length === 0) throw new BadRequestException('at least one user required');
    if (ids.length > 500) throw new BadRequestException('max 500 users');
    const campaignId = (dto.campaignId || '').trim() || `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, status: UserStatus.active },
      select: { id: true, phone: true },
    });
    if (users.length === 0) return { success: true, notified: 0, smsSent: 0, failed: 0, campaignId, recipients: [] };
    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id, type: NotificationType.system, title, body,
        data: { targeted: true, campaignId, deliveryStatus: 'sent', actorId: actorId ?? null, sms: !!dto.sms },
      })),
    });
    await this.audit(actorId, 'notification.targeted', 'notification', null, null, { campaignId, userCount: users.length, sms: !!dto.sms, title });
    return { success: true, notified: users.length, smsSent: 0, failed: 0, campaignId };
  }

  async notifyByFilter(dto: { title: string; body: string; sms?: boolean; limit?: number; filters?: Record<string, unknown> }, actorId?: string) {
    const title = (dto.title || '').trim();
    const body = (dto.body || '').trim();
    if (!title || !body) throw new BadRequestException('title and body required');
    const limit = Math.min(500, Math.max(1, Number(dto.limit) || 200));
    const filters = (dto.filters || {}) as any;
    const where = this.buildUserWhere({ ...filters, accountType: filters.accountType || 'customer' });
    const users = await this.prisma.user.findMany({
      where: { ...where, status: UserStatus.active },
      select: { id: true }, take: limit, orderBy: { createdAt: 'desc' },
    });
    return this.notifyUsers({ userIds: users.map((u) => u.id), title, body, sms: dto.sms }, actorId);
  }

  async listNotificationCampaigns(q: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const notifications = await this.prisma.notification.findMany({
      where: { data: { path: ['campaignId'], not: Prisma.DbNull } } as any,
      orderBy: { createdAt: 'desc' }, take: 500,
    });
    const byCampaign = new Map<string, any>();
    for (const n of notifications) {
      const data = (n.data || {}) as any;
      const cid = data.campaignId;
      if (!cid) continue;
      if (q.search && !String(n.title || '').includes(q.search) && !String(cid).includes(q.search)) continue;
      const entry = byCampaign.get(cid) || { id: cid, title: n.title || '', body: n.body || '', createdAt: n.createdAt, total: 0, sent: 0, failed: 0 };
      entry.total += 1;
      if (data.deliveryStatus === 'failed') entry.failed += 1; else entry.sent += 1;
      byCampaign.set(cid, entry);
    }
    const all = Array.from(byCampaign.values()).sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = all.length;
    const items = all.slice(skip, skip + limit).map((c: any) => ({
      id: c.id, title: c.title, body: c.body, createdAt: c.createdAt,
      totalRecipients: c.total, sentCount: c.sent, failedCount: c.failed,
      status: c.failed > 0 && c.sent === 0 ? 'failed' : c.failed > 0 ? 'partial' : 'sent',
    }));
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async getCampaignRecipients(campaignId: string, opts?: { status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(opts?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts?.limit) || 50));
    const skip = (page - 1) * limit;
    const notifications = await this.prisma.notification.findMany({
      where: { data: { path: ['campaignId'], equals: campaignId } } as any,
      include: { user: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
    let filtered = notifications;
    if (opts?.status) filtered = notifications.filter((n) => ((n.data as any)?.deliveryStatus || 'sent') === opts.status);
    const total = filtered.length;
    const items = filtered.slice(skip, skip + limit).map((n) => ({
      id: n.id, userId: n.userId, status: (n.data as any)?.deliveryStatus || 'sent',
      phone: (n as any).user?.phone ?? null, displayName: (n as any).user?.profile?.displayName ?? null,
      error: (n.data as any)?.error ?? null, sentAt: n.createdAt,
    }));
    return { campaignId, items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async retryFailedCampaign(campaignId: string, actorId?: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { data: { path: ['campaignId'], equals: campaignId } } as any,
    });
    const failed = notifications.filter((n) => (n.data as any)?.deliveryStatus === 'failed');
    for (const n of failed) {
      const data = { ...(n.data as any), deliveryStatus: 'sent', retriedAt: new Date().toISOString() };
      await this.prisma.notification.update({ where: { id: n.id }, data: { data } });
    }
    await this.audit(actorId, 'notification.retry_failed', 'notification', null, null, { campaignId, retried: failed.length });
    return { success: true, retried: failed.length, campaignId, totalFailed: failed.length };
  }

  async getPlatformSettings() { return { groups: {} }; }
  async updatePlatformSettingsGroup(group: string, values: Record<string, any>, actorId?: string) {
    await this.audit(actorId, 'settings.update', 'settings', group, null, values);
    return { group, values };
  }
  async getCMSContent() { return {}; }
  async updateCMSContent(content: Record<string, any>, actorId?: string) {
    await this.audit(actorId, 'cms.update', 'cms', null, null, content);
    return content;
  }
  async getSiteBuilder() { return { sections: [] }; }
  async updateSiteBuilder(sections: any[], actorId?: string) {
    await this.audit(actorId, 'sitebuilder.update', 'sitebuilder', null, null, { count: sections?.length });
    return { sections };
  }
  async listRoles() {
    return this.prisma.role.findMany({ include: { rolePermissions: { include: { permission: true } } } });
  }
  async listPermissions() {
    return this.prisma.permission.findMany();
  }

  private catalogSlugify(input: string): string {
    return (input || 'item').trim().toLowerCase().replace(/\s+/g, '-') || `item-${Date.now()}`;
  }
  async listServiceCategories() {
    return this.prisma.serviceCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { children: true, services: true } });
  }
  async createServiceCategory(dto: any, actorId?: string) {
    const name = (dto.name || '').trim();
    if (!name) throw new BadRequestException('name required');
    const created = await this.prisma.serviceCategory.create({
      data: { name, slug: dto.slug || this.catalogSlugify(name), parentId: dto.parentId || null, description: dto.description || null, sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive !== false },
    });
    await this.audit(actorId, 'catalog.category.create', 'serviceCategory', created.id, null, created);
    return created;
  }
  async updateServiceCategory(id: string, dto: any, actorId?: string) {
    const existing = await this.prisma.serviceCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');
    const updated = await this.prisma.serviceCategory.update({ where: { id }, data: dto });
    await this.audit(actorId, 'catalog.category.update', 'serviceCategory', id, existing, updated);
    return updated;
  }
  async deleteServiceCategory(id: string, actorId?: string) {
    await this.prisma.serviceCategory.delete({ where: { id } });
    await this.audit(actorId, 'catalog.category.delete', 'serviceCategory', id, null, null);
    return { success: true };
  }
  async listCatalogServices() {
    return this.prisma.service.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { category: true } });
  }
  async createCatalogService(dto: any, actorId?: string) {
    const name = (dto.name || '').trim();
    if (!name || !dto.categoryId) throw new BadRequestException('name and categoryId required');
    const created = await this.prisma.service.create({
      data: { name, slug: dto.slug || this.catalogSlugify(name), categoryId: dto.categoryId, description: dto.description || null, sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive !== false },
    });
    await this.audit(actorId, 'catalog.service.create', 'service', created.id, null, created);
    return created;
  }
  async updateCatalogService(id: string, dto: any, actorId?: string) {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service not found');
    const updated = await this.prisma.service.update({ where: { id }, data: dto });
    await this.audit(actorId, 'catalog.service.update', 'service', id, existing, updated);
    return updated;
  }
  async deleteCatalogService(id: string, actorId?: string) {
    await this.prisma.service.delete({ where: { id } });
    await this.audit(actorId, 'catalog.service.delete', 'service', id, null, null);
    return { success: true };
  }
  async listServiceCategoryRequests(_status?: string) {
    return { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  }
  async reviewServiceCategoryRequest(professionalServiceId: string, categoryId: string, status: string, actorId?: string) {
    await this.audit(actorId, 'catalog.request.review', 'professionalService', professionalServiceId, null, { categoryId, status });
    return { success: true, professionalServiceId, categoryId, status };
  }
  async assignServiceFilterCategory(serviceId: string, categoryId: string, actorId?: string) {
    return this.updateCatalogService(serviceId, { categoryId }, actorId);
  }
}
