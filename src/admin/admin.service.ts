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
    return { key: PLATFORM_COMMISSION_RATE_KEY, rate: DEFAULT_PLATFORM_COMMISSION_RATE, defaultRate: DEFAULT_PLATFORM_COMMISSION_RATE, updatedAt: null, notice: '' };
  }

  async updateCommissionSetting(newRate: number, _adminUserId?: string) {
    if (typeof newRate !== 'number' || isNaN(newRate) || newRate < 0 || newRate > 100) {
      throw new BadRequestException('Commission rate must be between 0 and 100');
    }
    return { key: PLATFORM_COMMISSION_RATE_KEY, rate: newRate, defaultRate: DEFAULT_PLATFORM_COMMISSION_RATE, updatedAt: new Date().toISOString() };
  }

  async getFailedTransactionsAlert() {
    return { count: 0, threshold: 3, triggered: false };
  }

  async updateFailedTransactionsThreshold(threshold: number, _adminUserId?: string) {
    return { threshold };
  }

  // PHASE1_ENRICHED_LIST_USERS_PLACEHOLDER_SEE_NEXT
  async listUsers(q: { page?: number; limit?: number; search?: string; status?: UserStatus; role?: string; accountType?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};
    if (!q.accountType || q.accountType === 'customer') {
      where.accountType = 'customer';
    } else if (q.accountType === 'professional') {
      where.accountType = 'professional';
    }
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
    const userIds = items.map((u) => u.id);
    const statusGroups = userIds.length === 0 ? [] : await this.prisma.booking.groupBy({
      by: ['customerId', 'status'],
      where: { customerId: { in: userIds } },
      _count: true,
    });
    const paidBookings = userIds.length === 0 ? [] : await this.prisma.payment.findMany({
      where: { status: PaymentStatus.paid, booking: { customerId: { in: userIds } } },
      select: { amount: true, booking: { select: { customerId: true } } },
    });
    const paidMap = new Map<string, number>();
    for (const p of paidBookings) {
      const cid = p.booking.customerId;
      paidMap.set(cid, (paidMap.get(cid) || 0) + (p.amount || 0));
    }
    const statusMap = new Map<string, Record<string, number>>();
    for (const g of statusGroups) {
      const m = statusMap.get(g.customerId) || {};
      m[g.status] = g._count;
      statusMap.set(g.customerId, m);
    }
    return {
      items: items.map((u) => {
        const lastBooking = u.bookingsAsCustomer[0] || null;
        const lastNotif = u.notifications[0] || null;
        const st = statusMap.get(u.id) || {};
        const successful = (st['completed'] || 0) + (st['confirmed'] || 0);
        const cancelled = (st['cancelled'] || 0) + (st['rejected'] || 0);
        const pending = (st['pending'] || 0) + (st['expired'] || 0);
        return {
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
          successfulBookings: successful,
          cancelledBookings: cancelled,
          pendingBookings: pending,
          totalPaid: paidMap.get(u.id) ?? 0,
          lastBooking: lastBooking
            ? {
                id: lastBooking.id,
                startAt: lastBooking.startAt,
                status: lastBooking.status,
                totalPrice: lastBooking.totalPrice,
                city: lastBooking.location?.city ?? null,
              }
            : null,
          lastNotification: lastNotif
            ? { id: lastNotif.id, title: lastNotif.title, createdAt: lastNotif.createdAt }
            : null,
          city: lastBooking?.location?.city ?? null,
        };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    const [bookings, reviews, favorites, notifications, paidAgg, auditLogs] = await Promise.all([
      this.prisma.booking.findMany({
        where: { customerId: id },
        orderBy: { startAt: 'desc' },
        take: 50,
        include: {
          professional: { select: { id: true, title: true, slug: true } },
          items: { include: { service: { select: { id: true, name: true } } } },
          payment: true,
          location: { select: { city: true, address: true } },
        },
      }),
      this.prisma.review.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { professional: { select: { id: true, title: true } } },
      }),
      this.prisma.favorite.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: {
          professional: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
            },
          },
        },
      }),
      this.prisma.notification.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, type: true, title: true, body: true, readAt: true, createdAt: true, data: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.paid, booking: { customerId: id } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.auditLog.findMany({
        where: { OR: [{ entityType: 'user', entityId: id }, { actorId: id }] },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
    ]);
    const successful = bookings.filter((b) => ['completed', 'confirmed'].includes(b.status)).length;
    const cancelled = bookings.filter((b) => ['cancelled', 'rejected'].includes(b.status)).length;
    const pending = bookings.filter((b) => ['pending', 'expired'].includes(b.status)).length;
    type ActivityItem = { at: string; kind: string; label: string; meta?: Record<string, unknown> };
    const activity: ActivityItem[] = [];
    activity.push({ at: user.createdAt.toISOString(), kind: 'register', label: 'ثبت‌نام در سیستم' });
    if (user.lastLoginAt) {
      activity.push({ at: user.lastLoginAt.toISOString(), kind: 'login', label: 'آخرین ورود' });
    }
    for (const b of bookings.slice(0, 20)) {
      activity.push({
        at: b.createdAt.toISOString(),
        kind: 'booking_created',
        label: `رزرو ایجاد شد — ${b.professional?.title || 'زیباگر'}`,
        meta: { bookingId: b.id, status: b.status },
      });
      if (b.cancelledAt) {
        activity.push({
          at: b.cancelledAt.toISOString(),
          kind: 'booking_cancelled',
          label: `رزرو لغو شد${b.cancelReason ? ` — ${b.cancelReason}` : ''}`,
          meta: { bookingId: b.id },
        });
      }
      if (b.completedAt) {
        activity.push({
          at: b.completedAt.toISOString(),
          kind: 'booking_completed',
          label: 'رزرو تکمیل شد',
          meta: { bookingId: b.id },
        });
      }
      if (b.payment?.paidAt) {
        activity.push({
          at: b.payment.paidAt.toISOString(),
          kind: 'payment',
          label: `پرداخت موفق — ${b.payment.amount?.toLocaleString('fa-IR') || ''} تومان`,
          meta: { bookingId: b.id, amount: b.payment.amount },
        });
      } else if (b.payment?.status === 'failed' && b.payment.failedAt) {
        activity.push({
          at: b.payment.failedAt.toISOString(),
          kind: 'payment_failed',
          label: 'پرداخت ناموفق',
          meta: { bookingId: b.id },
        });
      }
    }
    for (const r of reviews.slice(0, 10)) {
      activity.push({
        at: r.createdAt.toISOString(),
        kind: 'review',
        label: `ثبت نظر (${r.rating}★) برای ${r.professional?.title || 'زیباگر'}`,
        meta: { reviewId: r.id, rating: r.rating },
      });
    }
    for (const f of favorites.slice(0, 10)) {
      activity.push({
        at: f.createdAt.toISOString(),
        kind: 'favorite',
        label: `علاقه‌مندی — ${f.professional?.title || 'زیباگر'}`,
        meta: { professionalId: f.professionalId },
      });
    }
    for (const n of notifications.slice(0, 15)) {
      activity.push({
        at: n.createdAt.toISOString(),
        kind: 'notification',
        label: `اعلان: ${n.title}`,
        meta: { notificationId: n.id, type: n.type },
      });
    }
    activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return {
      ...user,
      roles: user.userRoles.map((ur) => ur.role.name),
      stats: {
        totalBookings: bookings.length,
        successfulBookings: successful,
        cancelledBookings: cancelled,
        pendingBookings: pending,
        totalPaid: paidAgg._sum.amount ?? 0,
        paidTransactions: paidAgg._count ?? 0,
        professionalsUsed: new Set(bookings.map((b) => b.professionalId)).size,
        reviewsCount: reviews.length,
        favoritesCount: favorites.length,
      },
      bookings,
      reviews,
      favorites,
      notifications,
      activity: activity.slice(0, 60),
      auditLogs,
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
    if (uniqueNames.length === 0) throw new BadRequestException('حداقل یک نقش لازم است');
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

  async listProfessionals(q: { page?: number; limit?: number; search?: string; status?: ProfessionalStatus; isFeatured?: boolean }) {
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
        { user: { profile: { displayName: { contains: term, mode: 'insensitive' } } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
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

  async listBookings(q: { page?: number; limit?: number; search?: string; status?: BookingStatus; startDate?: string; endDate?: string }) {
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
        { customer: { phone: { contains: term } } },
        { customer: { profile: { displayName: { contains: term, mode: 'insensitive' } } } },
        { professional: { title: { contains: term, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where, skip, take: limit, orderBy: { startAt: 'desc' },
        include: {
          customer: { include: { profile: true } },
          professional: true,
          payment: true,
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
        items: { include: { service: true } },
        payment: true,
        review: true,
        location: true,
      },
    });
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }

  async updateBookingStatus(id: string, status: BookingStatus, actorId?: string, reason?: string) {
    const existing = await this.prisma.booking.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Booking not found');
    const data: Prisma.BookingUpdateInput = { status };
    if (status === BookingStatus.cancelled) {
      data.cancelledAt = new Date();
      data.cancelReason = reason ?? null;
    }
    if (status === BookingStatus.completed) data.completedAt = new Date();
    if (status === BookingStatus.confirmed) data.confirmedAt = new Date();
    const updated = await this.prisma.booking.update({ where: { id }, data });
    await this.audit(actorId, 'booking.status_change', 'booking', id, { status: existing.status }, { status, reason });
    return updated;
  }

  async listReviews(q: { page?: number; limit?: number; search?: string; rating?: number; isPublished?: boolean }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.ReviewWhereInput = {};
    if (q.rating) where.rating = q.rating;
    if (q.isPublished !== undefined) where.isPublished = q.isPublished;
    if (q.search?.trim()) {
      const term = q.search.trim();
      where.OR = [
        { comment: { contains: term, mode: 'insensitive' } },
        { professional: { title: { contains: term, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { professional: true, customer: { include: { profile: true } } },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async setReviewVisibility(id: string, isPublished: boolean, actorId?: string, reason?: string) {
    const updated = await this.prisma.review.update({ where: { id }, data: { isPublished } });
    await this.audit(actorId, 'review.visibility', 'review', id, null, { isPublished, reason });
    return updated;
  }

  async deleteReview(id: string, actorId?: string) {
    await this.prisma.review.delete({ where: { id } });
    await this.audit(actorId, 'review.delete', 'review', id, null, null);
    return { success: true };
  }

  async listMedia(q: { page?: number; limit?: number; search?: string; kind?: any; status?: MediaStatus; professionalId?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 24));
    const skip = (page - 1) * limit;
    const where: Prisma.MediaAssetWhereInput = {};
    if (q.kind) where.kind = q.kind;
    if (q.status) where.status = q.status;
    if (q.professionalId) where.professionalId = q.professionalId;
    const [items, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async setMediaStatus(id: string, status: MediaStatus, actorId?: string) {
    const updated = await this.prisma.mediaAsset.update({ where: { id }, data: { status } });
    await this.audit(actorId, 'media.status', 'media', id, null, { status });
    return updated;
  }

  async deleteMedia(id: string, actorId?: string) {
    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.audit(actorId, 'media.delete', 'media', id, null, null);
    return { success: true };
  }

  async listAuditLogs(q: { page?: number; limit?: number; action?: string; actorId?: string; entityType?: string; entityId?: string; startDate?: string; endDate?: string }) {
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
      this.prisma.auditLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async listNotifications(q: { page?: number; limit?: number; type?: NotificationType; search?: string }) {
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
    if (dto.target === 'professionals') {
      where.accountType = 'professional';
    } else if (dto.target === 'customers') {
      where.accountType = 'customer';
    }
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
    dto: { userIds: string[]; title: string; body: string; sms?: boolean },
    actorId?: string,
  ) {
    const title = (dto.title || '').trim();
    const body = (dto.body || '').trim();
    const ids = Array.from(new Set((dto.userIds || []).filter(Boolean)));
    if (!title || !body) throw new BadRequestException('title و body الزامی است');
    if (ids.length === 0) throw new BadRequestException('حداقل یک کاربر انتخاب شود');
    if (ids.length > 500) throw new BadRequestException('حداکثر ۵۰۰ کاربر در هر ارسال');
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, status: UserStatus.active },
      select: { id: true, phone: true },
    });
    if (users.length === 0) return { success: true, notified: 0, smsSent: 0 };
    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: NotificationType.system,
        title,
        body,
        data: { targeted: true, actorId: actorId ?? null, sms: !!dto.sms } as Prisma.InputJsonValue,
      })),
    });
    await this.audit(actorId, 'notification.targeted', 'notification', null, null, {
      userCount: users.length,
      sms: !!dto.sms,
      title,
    });
    return { success: true, notified: users.length, smsSent: dto.sms ? users.filter((u) => u.phone).length : 0 };
  }

  async getPlatformSettings() {
    const rows = await this.prisma.platformSetting.findMany();
    const out: Record<string, unknown> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  async updatePlatformSettingsGroup(group: string, values: Record<string, unknown>, actorId?: string) {
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
    await this.audit(actorId, 'site_builder.update', 'platform_setting', row.id, null, { count: sections?.length });
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
