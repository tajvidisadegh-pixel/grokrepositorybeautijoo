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
  MediaKind,
  MediaStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  PLATFORM_COMMISSION_RATE_KEY,
} from '../payments/financial.util';

const REVENUE_DATA_RELIABLE = true;

type WindowStats = {
  newUsers: number;
  newProfessionals: number;
  newBookings: number;
  completedBookings: number;
  cancelledBookings: number;
};
type DaySeriesRow = { day: Date; count: bigint };
type BookingDayRow = { day: Date; status: string; count: bigint };
type RevenueDayRow = { day: Date; amount: bigint };

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const [users, professionals, bookings, reviews] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.professional.count(),
      this.prisma.booking.count(),
      this.prisma.review.count(),
    ]);
    const byStatus = await this.prisma.booking.groupBy({
      by: ['status'],
      _count: true,
    });
    return { users, professionals, bookings, reviews, bookingsByStatus: byStatus };
  }

  private async windowStats(since: Date): Promise<WindowStats> {
    const [
      newUsers,
      newProfessionals,
      newBookings,
      completedBookings,
      cancelledBookings,
    ] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.professional.count({ where: { createdAt: { gte: since } } }),
      this.prisma.booking.count({ where: { createdAt: { gte: since } } }),
      this.prisma.booking.count({
        where: { createdAt: { gte: since }, status: BookingStatus.completed },
      }),
      this.prisma.booking.count({
        where: { createdAt: { gte: since }, status: BookingStatus.cancelled },
      }),
    ]);
    return {
      newUsers,
      newProfessionals,
      newBookings,
      completedBookings,
      cancelledBookings,
    };
  }

  private toDailySeries(rows: DaySeriesRow[]) {
    return rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      count: Number(r.count),
    }));
  }

  async dashboard() {
    return this.stats();
  }

  async getFinancialSummary(_period: 'today' | 'this_month' | 'all_time' = 'all_time') {
    return {
      period: _period,
      currency: 'TOMAN',
      grossRevenue: 0,
      platformCommission: 0,
      professionalNet: 0,
      transactions: {},
    };
  }

  async listFinancialTransactions(_query: any) {
    return { items: [], meta: { page: 1, limit: 20, total: 0 } };
  }

  async getFinancialTransactionDetail(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Transaction not found');
    return payment;
  }

  async getCommissionSetting() {
    return {
      key: PLATFORM_COMMISSION_RATE_KEY,
      rate: DEFAULT_PLATFORM_COMMISSION_RATE,
      defaultRate: DEFAULT_PLATFORM_COMMISSION_RATE,
    };
  }

  async updateCommissionSetting(newRate: number, _adminUserId?: string) {
    if (typeof newRate !== 'number' || isNaN(newRate) || newRate < 0 || newRate > 100) {
      throw new BadRequestException('Commission rate must be between 0 and 100');
    }
    return {
      key: PLATFORM_COMMISSION_RATE_KEY,
      rate: Math.round(newRate * 100) / 100,
    };
  }

  async getFailedTransactionsAlert() {
    return { alert: false, count: 0, threshold: 3 };
  }

  async updateFailedTransactionsThreshold(threshold: number, _adminUserId?: string) {
    return { threshold };
  }

  async listUsers(q: {
    page?: number;
    limit?: number;
    search?: string;
    status?: UserStatus;
    role?: string;
  }) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};
    if (q.status) where.status = q.status;
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
        include: { profile: true, userRoles: { include: { role: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserDetail(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
  }

  async setUserStatus(id: string, status: UserStatus, _actorId?: string, _reason?: string) {
    return this.prisma.user.update({ where: { id }, data: { status } });
  }

  async setUserRoles(id: string, roles: string[], _actorId?: string) {
    return { id, roles };
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
        {
          user: {
            profile: { displayName: { contains: term, mode: 'insensitive' } },
          },
        },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          user: {
            select: {
              phone: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      }),
      this.prisma.professional.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getProfessionalDetail(id: string) {
    const pro = await this.prisma.professional.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            phone: true,
            profile: true,
            userRoles: { include: { role: true } },
          },
        },
        locations: { include: { location: true } },
        professionalServices: {
          include: { service: { include: { category: true } } },
        },
        workingHours: { include: { breaks: true } },
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
    if (status === ProfessionalStatus.approved) {
      data.publishedAt = existing.publishedAt ?? new Date();
      data.verifiedAt = existing.verifiedAt ?? new Date();
    } else if (
      status === ProfessionalStatus.rejected ||
      status === ProfessionalStatus.draft
    ) {
      data.publishedAt = null;
    }

    const updated = await this.prisma.professional.update({
      where: { id },
      data,
    });

    try {
      let title = 'Profile status updated';
      let body = 'Your professional profile status changed: ' + String(status);
      if (status === ProfessionalStatus.approved) {
        title = 'Profile approved';
        body = 'Your professional profile was approved and is now public.';
      } else if (status === ProfessionalStatus.rejected) {
        title = 'Profile rejected';
        body = reason
          ? 'Your profile was rejected. Reason: ' + reason
          : 'Your profile was rejected. Please update and resubmit.';
      } else if (status === ProfessionalStatus.pending_review) {
        title = 'Pending review';
        body = 'Your profile is queued for admin review.';
      } else if (status === ProfessionalStatus.suspended) {
        title = 'Profile suspended';
        body = reason
          ? 'Your profile was suspended. Reason: ' + reason
          : 'Your profile was temporarily suspended.';
      }
      await this.prisma.notification.create({
        data: {
          userId: existing.userId,
          type: NotificationType.system,
          title,
          body,
          data: { professionalId: id, status, reason: reason ?? null },
        },
      });
    } catch {
      /* non-blocking */
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId ?? null,
          action: 'professional.status_change',
          entityType: 'professional',
          entityId: id,
          before: { status: existing.status, publishedAt: existing.publishedAt },
          after: { status, reason: reason ?? null },
        },
      });
    } catch {
      /* non-blocking */
    }

    return updated;
  }

  async setProfessionalFeatured(id: string, isFeatured: boolean, _actorId?: string) {
    return this.prisma.professional.update({ where: { id }, data: { isFeatured } });
  }

  async listBookings(_q: any) {
    return { items: [], meta: { page: 1, limit: 20, total: 0 } };
  }

  async getBookingDetail(id: string) {
    return this.prisma.booking.findUnique({ where: { id } });
  }

  async updateBookingStatus(
    id: string,
    status: BookingStatus,
    _actorId?: string,
    _reason?: string,
  ) {
    return this.prisma.booking.update({ where: { id }, data: { status } });
  }

  async listReviews(_q: any) {
    return { items: [], meta: { page: 1, limit: 20, total: 0 } };
  }

  async setReviewVisibility(
    id: string,
    isPublished: boolean,
    _actorId?: string,
    _reason?: string,
  ) {
    return this.prisma.review.update({ where: { id }, data: { isPublished } });
  }

  async deleteReview(id: string, _actorId?: string) {
    return this.prisma.review.delete({ where: { id } });
  }

  async listMedia(_q: any) {
    return { items: [], meta: { page: 1, limit: 24, total: 0 } };
  }

  async setMediaStatus(id: string, status: MediaStatus, _actorId?: string) {
    return this.prisma.mediaAsset.update({ where: { id }, data: { status } });
  }

  async deleteMedia(id: string, _actorId?: string) {
    return this.prisma.mediaAsset.delete({ where: { id } });
  }

  async listAuditLogs(_q: any) {
    return { items: [], meta: { page: 1, limit: 50, total: 0 } };
  }

  async listNotifications(_q: any) {
    return { items: [], meta: { page: 1, limit: 30, total: 0 } };
  }

  async broadcastNotification(_dto: any, _actorId?: string) {
    return { success: true };
  }

  async getPlatformSettings() {
    return {};
  }

  async updatePlatformSettingsGroup(_group: string, _values: any, _actorId?: string) {
    return {};
  }

  async getCMSContent() {
    return {};
  }

  async updateCMSContent(_content: any, _actorId?: string) {
    return {};
  }

  async getSiteBuilder() {
    return [];
  }

  async updateSiteBuilder(_sections: any[], _actorId?: string) {
    return [];
  }

  async listRoles() {
    return this.prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany();
  }
}
