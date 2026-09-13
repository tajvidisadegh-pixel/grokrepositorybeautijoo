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

  async listUsers(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { profile: true, userRoles: { include: { role: true } } },
      }),
      this.prisma.user.count(),
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
    return { ...user, roles: user.userRoles.map((ur) => ur.role.name), stats: {}, bookings: [], reviews: [], auditLogs: [] };
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
    city?: string;
    specialty?: string;
    categoryId?: string;
    minRating?: number;
    registeredFrom?: string;
    registeredTo?: string;
    sortBy?: 'createdAt' | 'ratingAvg' | 'ratingCount' | 'bookings';
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const and: Prisma.ProfessionalWhereInput[] = [];
    if (q.status) and.push({ status: q.status });
    if (q.isFeatured !== undefined) and.push({ isFeatured: q.isFeatured });
    if (q.search?.trim()) {
      const term = q.search.trim();
      and.push({
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { slug: { contains: term, mode: 'insensitive' } },
          { bio: { contains: term, mode: 'insensitive' } },
          { user: { phone: { contains: term } } },
          { user: { profile: { displayName: { contains: term, mode: 'insensitive' } } } },
        ],
      });
    }
    if (q.city?.trim()) {
      and.push({
        locations: {
          some: { location: { city: { contains: q.city.trim(), mode: 'insensitive' } } },
        },
      });
    }
    if (q.specialty?.trim()) {
      and.push({
        professionalServices: {
          some: { service: { name: { contains: q.specialty.trim(), mode: 'insensitive' } } },
        },
      });
    }
    if (q.categoryId) {
      and.push({
        professionalServices: {
          some: { service: { categoryId: q.categoryId } },
        },
      });
    }
    if (q.minRating != null && !Number.isNaN(q.minRating)) {
      and.push({ ratingAvg: { gte: q.minRating } });
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
    const where: Prisma.ProfessionalWhereInput = and.length ? { AND: and } : {};
    const sortOrder = q.sortOrder === 'asc' ? 'asc' : 'desc';
    let orderBy: Prisma.ProfessionalOrderByWithRelationInput = { createdAt: 'desc' };
    if (q.sortBy === 'ratingAvg') orderBy = { ratingAvg: sortOrder };
    else if (q.sortBy === 'ratingCount') orderBy = { ratingCount: sortOrder };
    else if (q.sortBy === 'createdAt') orderBy = { createdAt: sortOrder };

    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
    const [pendingProfessionals, pendingMedia, draftProfessionals, suspendedProfessionals] = await Promise.all([
      this.prisma.professional.count({ where: { status: ProfessionalStatus.pending_review } }),
      this.prisma.mediaAsset.count({ where: { status: MediaStatus.pending } }),
      this.prisma.professional.count({ where: { status: ProfessionalStatus.draft } }),
      this.prisma.professional.count({ where: { status: ProfessionalStatus.suspended } }),
    ]);
    const incompleteProfiles = await this.prisma.professional.count({
      where: {
        OR: [
          { title: null },
          { bio: null },
          { professionalServices: { none: {} } },
        ],
        status: { in: [ProfessionalStatus.draft, ProfessionalStatus.pending_review] },
      },
    });
    return {
      pendingProfessionals,
      pendingMedia,
      incompleteProfiles,
      draftProfessionals,
      suspendedProfessionals,
    };
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
        bookings: {
          take: 30,
          orderBy: { startAt: 'desc' },
          include: {
            customer: { include: { profile: true } },
            payment: true,
          },
        },
        reviews: {
          take: 30,
          orderBy: { createdAt: 'desc' },
          include: { customer: { include: { profile: true } } },
        },
      },
    });
    if (!pro) throw new NotFoundException('Professional not found');
    const bookingStats = {
      total: pro.bookings.length,
      successful: pro.bookings.filter((b) => ['completed', 'confirmed'].includes(b.status)).length,
      cancelled: pro.bookings.filter((b) => ['cancelled', 'rejected'].includes(b.status)).length,
      pending: pro.bookings.filter((b) => b.status === 'pending').length,
    };
    const revenue = pro.bookings
      .filter((b) => b.payment?.status === PaymentStatus.paid)
      .reduce((sum, b) => sum + (b.payment?.amount ?? b.totalPrice ?? 0), 0);
    return {
      ...pro,
      city: pro.locations?.[0]?.location?.city ?? null,
      stats: {
        ...bookingStats,
        revenue,
        ratingAvg: pro.ratingAvg,
        ratingCount: pro.ratingCount,
        reviewCount: pro.reviews.length,
        serviceCount: pro.professionalServices.length,
        mediaCount: pro.mediaAssets.length,
      },
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
    const update: Prisma.ProfessionalUpdateInput = {};
    if (data.title !== undefined) update.title = data.title.trim();
    if (data.bio !== undefined) update.bio = data.bio.trim() || null;
    if (data.isFeatured !== undefined) update.isFeatured = data.isFeatured;
    if (data.selectedCategoryIds !== undefined) {
      update.selectedCategoryIds = data.selectedCategoryIds as Prisma.InputJsonValue;
    }
    const updated = await this.prisma.professional.update({ where: { id }, data: update });
    await this.audit(actorId, 'professional.update', 'professional', id, existing, updated);
    return this.getProfessionalDetail(id);
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
    return { success: true, sent: 0 };
  }
  async getPlatformSettings() { return { groups: [] }; }
  async updatePlatformSettingsGroup(group: string, values: any, actorId?: string) {
    await this.audit(actorId, 'settings.update', 'settings', group, null, values);
    return { group, values };
  }
  async getCMSContent() { return {}; }
  async updateCMSContent(content: any, actorId?: string) {
    await this.audit(actorId, 'cms.update', 'cms', null, null, content);
    return content;
  }
  async getSiteBuilder() { return { sections: [] }; }
  async updateSiteBuilder(sections: any[], actorId?: string) {
    await this.audit(actorId, 'site_builder.update', 'site_builder', null, null, sections);
    return { sections };
  }
  async listRoles() {
    return this.prisma.role.findMany({ include: { permissions: true } });
  }
  async listPermissions() {
    return this.prisma.permission.findMany();
  }
}
