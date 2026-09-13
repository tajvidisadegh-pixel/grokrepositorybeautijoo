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
}
