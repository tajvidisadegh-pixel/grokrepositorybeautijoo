import {
  Injectable,
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
  Prisma,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

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
        completedBookings: await this.prisma.booking.count({ where: { status: BookingStatus.completed } }),
        cancelledBookings: await this.prisma.booking.count({ where: { status: BookingStatus.cancelled } }),
        totalReviews: await this.prisma.review.count(),
        revenue: { available: true, total: 0 },
      },
      pending: { professionalsAwaitingReview: pendingProfessionals, pendingPayments: 0, failedPayments: 0 },
    };
  }

  async getFinancialSummary(_period?: string) {
    const paid = await this.prisma.payment.aggregate({
      where: { status: PaymentStatus.paid },
      _sum: { amount: true },
      _count: true,
    });
    return {
      period: _period || 'all_time',
      grossRevenue: Number(paid._sum.amount || 0),
      paidCount: paid._count,
    };
  }

  async listFinancialTransactions(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.PaymentWhereInput = {};
    if (q.status) where.status = q.status;
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  async getFinancialTransactionDetail(id: string) {
    const row = await this.prisma.payment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Transaction not found');
    return row;
  }

  async getCommissionSetting() {
    return { rate: 10 };
  }

  async updateCommissionSetting(newRate: number, _adminUserId?: string) {
    return { rate: newRate };
  }

  async getFailedTransactionsAlert() {
    const count = await this.prisma.payment.count({ where: { status: PaymentStatus.failed } });
    return { count, threshold: 5 };
  }

  async listUsers(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.UserWhereInput = {};
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
    return {
      total: await this.prisma.user.count(),
      active: await this.prisma.user.count({ where: { status: UserStatus.active } }),
    };
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
    return this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
  }

  async listProfessionals(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.ProfessionalWhereInput = {};
    if (q.status) where.status = q.status;
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

  async getProfessionalDetail(id: string) {
    const p = await this.prisma.professional.findUnique({
      where: { id },
      include: { user: { include: { profile: true } }, professionalServices: true },
    });
    if (!p) throw new NotFoundException('Professional not found');
    return p;
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
        { id: { contains: s } },
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

  async deleteMedia(id: string, actorId?: string) {
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Media not found');
    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.audit(actorId, 'media.delete', 'media_asset', id, existing, null);
    return { success: true, id };
  }

  /** Published homepage CMS config (public). Stored in PlatformSetting. */
  async getPublishedSiteConfig() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_published' } });
    return (row?.value as object) ?? { version: 1, sections: [] };
  }

  /** Promote draft CMS to published. */
  async publishSiteCms(actorId?: string) {
    const draft = await this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_draft' } });
    const value = (draft?.value as Prisma.InputJsonValue) ?? ({ version: 1, sections: [] } as Prisma.InputJsonValue);
    await this.prisma.platformSetting.upsert({
      where: { key: 'site_cms_published' },
      create: { key: 'site_cms_published', value },
      update: { value },
    });
    await this.audit(actorId, 'site_cms.publish', 'platform_setting', 'site_cms_published', null, value);
    return { success: true, publishedAt: new Date().toISOString() };
  }

  /** Upload image for site CMS (hero/banners). Writes to STORAGE_LOCAL_PATH when available. */
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
    const key = `cms/${Date.now()}-${safeName}`;
    const base = process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), 'uploads');
    try {
      fs.mkdirSync(path.join(base, 'cms'), { recursive: true });
      fs.writeFileSync(path.join(base, key), buffer);
    } catch (e) {
      this.logger.warn(`CMS upload disk write failed: ${(e as Error)?.message || e}`);
    }
    const publicBase = (process.env.PUBLIC_FILES_BASE_URL || process.env.APP_URL || '').replace(/\/$/, '');
    const url = publicBase ? `${publicBase}/files/${key}` : `/files/${key}`;
    await this.audit(actorId, 'site_cms.upload', 'platform_setting', key, null, { url, slot, size: file.size });
    return { url, key, slot: slot || 'generic', mimeType: file.mimetype, size: file.size };
  }
}
