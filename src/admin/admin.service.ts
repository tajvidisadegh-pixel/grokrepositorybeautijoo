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
    const existing = await this.prisma.user.findFirst({
      where: { phone, accountType: 'customer' },
    });
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
      if (phone) {
        await this.prisma.user.update({ where: { id }, data: { phone } });
      }
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

  async softDeleteUser(id: string, actorId?: string, reason?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.deleted },
    });
    userAuthCache.invalidate(id);
    await this.audit(actorId, 'user.soft_delete', 'user', id, { status: existing.status }, { status: UserStatus.deleted, reason });
    return updated;
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
    return {
      pendingProfessionals,
      pendingMedia,
      incompleteProfiles: 0,
      draftProfessionals,
      suspendedProfessionals,
    };
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

  private static readonly CMS_DRAFT_KEY = 'site.cms.draft';
  private static readonly CMS_PUBLISHED_KEY = 'site.cms.published';
  private static readonly BUILDER_DRAFT_KEY = 'site.builder.draft';
  private static readonly BUILDER_PUBLISHED_KEY = 'site.builder.published';

  private defaultCmsContent() {
    return {
      hero: {
        enabled: true,
        title: 'بیوتی‌جو، رزرو آنلاین نوبت',
        subtitle: 'آسان و سریع',
        description: 'زیباگر مناسب خود را پیدا کنید — آرایش، ناخن، پوست و بیشتر، نزدیک شما',
        ctaText: 'جستجو',
        ctaLink: '/search',
        badge: 'بیوتی‌جو · رزرو آنلاین نوبت',
        desktopImageUrl: null as string | null,
        mobileImageUrl: null as string | null,
      },
      texts: {
        categoriesTitle: 'دسته‌بندی‌های محبوب',
        categoriesLinkText: 'همه خدمات',
        featuredTitle: 'زیباگرهای برتر هفته',
        featuredLinkText: 'مشاهده همه',
        ctaTitle: 'آماده رزرو هستید؟',
        ctaDescription: 'زیباگر را انتخاب کنید، زمان آزاد را ببینید و نوبت بگیرید.',
        ctaPrimaryText: 'شروع جستجو',
        ctaPrimaryLink: '/search',
        ctaSecondaryText: 'ثبت‌نام رایگان',
        ctaSecondaryLink: '/register',
      },
      features: {
        showCategories: true,
        showFeaturedProfessionals: true,
        showBottomCta: true,
        showSearchInHero: true,
      },
      version: 1,
      updatedAt: null as string | null,
    };
  }

  private defaultSections() {
    return [
      { id: 'hero', label: 'Hero', enabled: true, sortOrder: 0 },
      { id: 'categories', label: 'دسته‌بندی‌های محبوب', enabled: true, sortOrder: 1 },
      { id: 'featured', label: 'زیباگرهای برتر', enabled: true, sortOrder: 2 },
      { id: 'cta', label: 'دعوت به اقدام', enabled: true, sortOrder: 3 },
    ];
  }

  private async getSettingJson<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (!row || row.value === null || row.value === undefined) return fallback;
    return row.value as T;
  }

  private async setSettingJson(key: string, value: unknown) {
    const json = value as Prisma.InputJsonValue;
    return this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: json },
      update: { value: json },
    });
  }

  async getPlatformSettings() {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { startsWith: 'settings.' } },
    });
    const out: Record<string, unknown> = {};
    for (const r of rows) {
      const group = r.key.replace(/^settings\./, '');
      out[group] = r.value;
    }
    return out;
  }

  async updatePlatformSettingsGroup(group: string, values: Record<string, unknown>, actorId?: string) {
    const key = `settings.${String(group || '').trim()}`;
    if (!group || key.length > 100) throw new BadRequestException('Invalid settings group');
    const before = await this.getSettingJson(key, null);
    await this.setSettingJson(key, values);
    await this.audit(actorId, 'settings.update', 'platform_setting', null, before, values);
    return { group, values };
  }

  async getCMSContent() {
    const draft = await this.getSettingJson(AdminService.CMS_DRAFT_KEY, this.defaultCmsContent());
    const published = await this.getSettingJson(AdminService.CMS_PUBLISHED_KEY, null);
    return {
      draft,
      published,
      hasUnpublishedChanges: JSON.stringify(draft) !== JSON.stringify(published),
    };
  }

  async updateCMSContent(content: Record<string, unknown>, actorId?: string) {
    const before = await this.getSettingJson(AdminService.CMS_DRAFT_KEY, this.defaultCmsContent());
    const next = {
      ...this.defaultCmsContent(),
      ...before,
      ...content,
      version: (typeof (before as { version?: number })?.version === 'number'
        ? (before as { version: number }).version
        : 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    await this.setSettingJson(AdminService.CMS_DRAFT_KEY, next);
    await this.audit(actorId, 'cms.draft.update', 'platform_setting', null, before, next);
    return { draft: next, published: await this.getSettingJson(AdminService.CMS_PUBLISHED_KEY, null) };
  }

  async getSiteBuilder() {
    const draftSections = await this.getSettingJson(AdminService.BUILDER_DRAFT_KEY, this.defaultSections());
    const publishedSections = await this.getSettingJson(AdminService.BUILDER_PUBLISHED_KEY, null);
    return {
      draft: { sections: draftSections },
      published: publishedSections ? { sections: publishedSections } : null,
      hasUnpublishedChanges: JSON.stringify(draftSections) !== JSON.stringify(publishedSections),
    };
  }

  async updateSiteBuilder(sections: unknown[], actorId?: string) {
    if (!Array.isArray(sections)) throw new BadRequestException('sections must be an array');
    const before = await this.getSettingJson(AdminService.BUILDER_DRAFT_KEY, this.defaultSections());
    const normalized = sections.map((s, i) => {
      const row = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
      return {
        id: String(row.id || `section_${i}`),
        label: String(row.label || row.id || `Section ${i + 1}`),
        enabled: row.enabled !== false,
        sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : i,
      };
    });
    normalized.sort((a, b) => a.sortOrder - b.sortOrder);
    await this.setSettingJson(AdminService.BUILDER_DRAFT_KEY, normalized);
    await this.audit(actorId, 'site_builder.draft.update', 'platform_setting', null, before, normalized);
    return { sections: normalized };
  }

  async publishSiteCms(actorId?: string) {
    const draftContent = await this.getSettingJson(AdminService.CMS_DRAFT_KEY, this.defaultCmsContent());
    const draftSections = await this.getSettingJson(AdminService.BUILDER_DRAFT_KEY, this.defaultSections());
    const prevPublishedContent = await this.getSettingJson(AdminService.CMS_PUBLISHED_KEY, null);
    const prevPublishedSections = await this.getSettingJson(AdminService.BUILDER_PUBLISHED_KEY, null);
    const publishedAt = new Date().toISOString();
    const contentToPublish = { ...(draftContent as object), publishedAt };
    await this.setSettingJson(AdminService.CMS_PUBLISHED_KEY, contentToPublish);
    await this.setSettingJson(AdminService.BUILDER_PUBLISHED_KEY, draftSections);
    await this.audit(actorId, 'cms.publish', 'platform_setting', null, {
      content: prevPublishedContent,
      sections: prevPublishedSections,
    }, { content: contentToPublish, sections: draftSections, publishedAt });
    return { success: true, publishedAt, content: contentToPublish, sections: draftSections };
  }

  async getPublishedSiteConfig() {
    const content = await this.getSettingJson(AdminService.CMS_PUBLISHED_KEY, this.defaultCmsContent());
    const sections = await this.getSettingJson(AdminService.BUILDER_PUBLISHED_KEY, this.defaultSections());
    return { content, sections };
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
    if (filters.status) where.status = String(filters.status) as any;
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
    return this.prisma.service.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { category: true },
    });
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
    return { items: [] };
  }

  async reviewServiceCategoryRequest(professionalServiceId: string, categoryId: string, status: string, actorId?: string) {
    await this.audit(actorId, 'catalog.category_request.review', 'professional_service', professionalServiceId, null, { categoryId, status });
    return { success: true, professionalServiceId, categoryId, status };
  }

  async assignServiceFilterCategory(serviceId: string, categoryId: string, actorId?: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('Service not found');
    const updated = await this.prisma.service.update({ where: { id: serviceId }, data: { categoryId } });
    await this.audit(actorId, 'catalog.service.assign_category', 'service', serviceId, service, updated);
    return updated;
  }
}
