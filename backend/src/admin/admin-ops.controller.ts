import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaymentStatus, UserStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SMS_PROVIDER, SmsProvider } from '../sms/sms.provider';

class CreateCustomerDto {
  @IsString() phone!: string;
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
}
class UpdateUserProfileDto {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
}
class NotifyUsersDto {
  @IsArray() @IsString({ each: true }) userIds!: string[];
  @IsString() title!: string;
  @IsString() body!: string;
  @IsOptional() @IsBoolean() sms?: boolean;
}
class NotifyByFilterDto {
  @IsString() title!: string;
  @IsString() body!: string;
  @IsOptional() @IsBoolean() sms?: boolean;
  @IsOptional() @IsNumber() limit?: number;
  @IsOptional() filters?: Record<string, unknown>;
}
class FeaturedDto {
  @IsBoolean() isFeatured!: boolean;
}

/** Normalize Iranian mobile to 09xxxxxxxxx (#82.r2.8). */
function normalizeIranPhone(raw: string): string {
  let s = String(raw || '')
    .trim()
    .replace(/[\s-]/g, '');
  if (s.startsWith('+98')) s = '0' + s.slice(3);
  else if (s.startsWith('98') && s.length >= 12) s = '0' + s.slice(2);
  else if (s.startsWith('9') && s.length === 10) s = '0' + s;
  return s;
}

/** Strip HTML/script from CMS strings to mitigate stored XSS (#82.r2.5). */
function stripHtmlDeep(value: unknown, depth = 0): unknown {
  if (depth > 12) return typeof value === 'string' ? value.replace(/<[^>]*>/g, '').slice(0, 5000) : value;
  if (typeof value === 'string') {
    return value
      .replace(/<\s*(script|iframe|object|embed|link|meta|style)[\s\S]*?>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(script|iframe|object|embed|link|meta|style)[^>]*>/gi, '')
      .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/<\/?[^>]+>/g, '');
  }
  if (Array.isArray(value)) return value.map((v) => stripHtmlDeep(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripHtmlDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

@ApiTags('admin-ops')
@ApiBearerAuth()
@Controller('admin')
export class AdminOpsController {
  private readonly logger = new Logger(AdminOpsController.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  private async audit(
    actorId: string | undefined,
    action: string,
    entityType: string,
    entityId: string,
    after?: unknown,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action,
          entityType,
          entityId,
          after: (after ?? {}) as object,
        },
      });
    } catch {
      /* non-blocking */
    }
  }

  @RequirePermissions('admin.site_builder.manage')
  @Get('content')
  async getContent() {
    const [draftRow, publishedRow] = await Promise.all([
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_content' } }),
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_published' } }),
    ]);
    const empty = { hero: {}, texts: {}, features: {} };
    const draftRaw = (draftRow?.value as any) || {};
    const draft = {
      hero: draftRaw.hero ?? draftRaw.content?.hero ?? {},
      texts: draftRaw.texts ?? draftRaw.content?.texts ?? {},
      features: draftRaw.features ?? draftRaw.content?.features ?? {},
      updatedAt: draftRaw.updatedAt ?? null,
    };
    const pubRaw = (publishedRow?.value as any) || {};
    const publishedContent = pubRaw.content || {
      hero: pubRaw.hero || {},
      texts: pubRaw.texts || {},
      features: pubRaw.features || {},
    };
    const published = publishedRow
      ? {
          hero: publishedContent.hero || {},
          texts: publishedContent.texts || {},
          features: publishedContent.features || {},
          publishedAt: pubRaw.publishedAt || null,
          updatedAt: pubRaw.updatedAt || pubRaw.publishedAt || null,
        }
      : null;
    const hasUnpublishedChanges =
      JSON.stringify({
        hero: draft.hero || {},
        texts: draft.texts || {},
        features: draft.features || {},
      }) !==
      JSON.stringify({
        hero: published?.hero || {},
        texts: published?.texts || {},
        features: published?.features || {},
      });
    const hasDraft =
      Object.keys(draft.hero || {}).length ||
      Object.keys(draft.texts || {}).length ||
      Object.keys(draft.features || {}).length;
    return {
      draft: hasDraft ? draft : { ...empty, ...draft },
      published,
      hasUnpublishedChanges: published ? hasUnpublishedChanges : true,
    };
  }

  @RequirePermissions('admin.site_builder.manage')
  @Put('content')
  async putContent(@Body() body: any, @CurrentUser('id') actorId?: string) {
    const rawSize = Buffer.byteLength(JSON.stringify(body ?? {}), 'utf8');
    if (rawSize > 400_000) throw new BadRequestException('payload too large');
    const cleaned = stripHtmlDeep({
      hero: body?.hero ?? {},
      texts: body?.texts ?? {},
      features: body?.features ?? {},
      updatedAt: new Date().toISOString(),
    }) as any;
    await this.prisma.platformSetting.upsert({
      where: { key: 'site_cms_content' },
      create: { key: 'site_cms_content', value: cleaned },
      update: { value: cleaned },
    });
    await this.audit(actorId, 'admin.cms.content.update', 'platform_setting', 'site_cms_content', {
      keys: Object.keys(cleaned),
    });
    return cleaned;
  }

  @RequirePermissions('admin.site_builder.manage')
  @Get('site-builder')
  async getSiteBuilder() {
    const [draftRow, publishedRow] = await Promise.all([
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_sections' } }),
      this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_published' } }),
    ]);
    const normalize = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (Array.isArray(val?.sections)) return val.sections;
      return [];
    };
    const draftSections = normalize(draftRow?.value);
    const publishedSections = normalize((publishedRow?.value as any)?.sections);
    const hasUnpublishedChanges = JSON.stringify(draftSections) !== JSON.stringify(publishedSections);
    return {
      draft: { sections: draftSections },
      published: publishedRow ? { sections: publishedSections } : null,
      hasUnpublishedChanges: publishedRow ? hasUnpublishedChanges : true,
    };
  }

  @RequirePermissions('admin.site_builder.manage')
  @Put('site-builder')
  async putSiteBuilder(@Body() body: any, @CurrentUser('id') actorId?: string) {
    const listRaw = Array.isArray(body) ? body : body?.sections ?? [];
    if (!Array.isArray(listRaw)) throw new BadRequestException('sections must be an array');
    const sbSize = Buffer.byteLength(JSON.stringify(listRaw), 'utf8');
    if (sbSize > 400_000) throw new BadRequestException('payload too large');
    if (listRaw.length > 200) throw new BadRequestException('حداکثر ۲۰۰ بخش مجاز است');
    const list = stripHtmlDeep(listRaw) as any[];
    await this.prisma.platformSetting.upsert({
      where: { key: 'site_cms_sections' },
      create: { key: 'site_cms_sections', value: list as any },
      update: { value: list as any },
    });
    await this.audit(actorId, 'admin.cms.site_builder.update', 'platform_setting', 'site_cms_sections', {
      sections: list.length,
    });
    return list;
  }

  @RequirePermissions('admin.users.write')
  @Post('users')
  async createCustomer(@Body() dto: CreateCustomerDto, @CurrentUser('id') actorId?: string) {
    const phone = normalizeIranPhone(dto.phone || '');
    if (!phone || phone.length < 10) throw new BadRequestException('phone required');
    if (await this.prisma.user.findFirst({ where: { phone, accountType: 'customer' as any } })) {
      throw new ConflictException('phone exists');
    }
    const user = await this.prisma.user.create({
      data: {
        phone,
        accountType: 'customer' as any,
        status: UserStatus.active,
        profile: {
          create: {
            displayName: (dto.displayName || dto.firstName || phone).trim(),
            firstName: dto.firstName?.trim() || null,
            lastName: dto.lastName?.trim() || null,
          },
        },
      },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
    await this.audit(actorId, 'admin.customer.create', 'user', user.id, { phone });
    return user;
  }

  @RequirePermissions('admin.users.write')
  @Patch('users/:id/profile')
  async updateUserProfile(
    @Param('id') id: string,
    @Body() dto: UpdateUserProfileDto,
    @CurrentUser('id') actorId?: string,
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('not found');
    if (dto.phone?.trim() && normalizeIranPhone(dto.phone) !== normalizeIranPhone(existing.phone || '')) {
      const nextPhone = normalizeIranPhone(dto.phone);
      if (
        await this.prisma.user.findFirst({
          where: { phone: nextPhone, NOT: { id } },
        })
      ) {
        throw new ConflictException('phone exists');
      }
      dto.phone = nextPhone;
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: { phone: nextPhone, phoneVerified: false },
        });
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
    }
    const profileData: any = {};
    if (dto.displayName !== undefined) profileData.displayName = dto.displayName.trim() || existing.phone || 'User';
    if (dto.firstName !== undefined) profileData.firstName = dto.firstName.trim() || null;
    if (dto.lastName !== undefined) profileData.lastName = dto.lastName.trim() || null;
    if (Object.keys(profileData).length) {
      await this.prisma.profile.upsert({
        where: { userId: id },
        update: profileData,
        create: {
          userId: id,
          displayName: profileData.displayName || existing.phone || 'User',
          firstName: profileData.firstName ?? null,
          lastName: profileData.lastName ?? null,
        },
      });
    }
    await this.audit(actorId, 'admin.user.profile.update', 'user', id, { phoneChanged: !!dto.phone, fieldKeys: Object.keys(dto || {}) });
    return this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
  }

  @RequirePermissions('admin.notifications.send')
  @Post('notifications/notify')
  async notifyUsers(@Body() dto: NotifyUsersDto, @CurrentUser('id') actorId?: string) {
    const title = String(dto.title || '').trim().slice(0, 200);
    const body = String(dto.body || '').trim().slice(0, 2000);
    if (!title || !body) throw new BadRequestException('title/body required');
    const ids = Array.from(new Set((dto.userIds || []).filter(Boolean))).slice(0, 5000);
    if (!ids.length) throw new BadRequestException('userIds required');

    const campaignId = `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const batchSize = 100;
    let notified = 0;
    let failed = 0;

    for (let i = 0; i < ids.length; i += batchSize) {
      const chunk = ids.slice(i, i + batchSize);
      try {
        const result = await this.prisma.notification.createMany({
          data: chunk.map((userId) => ({
            userId,
            type: 'system' as any,
            title,
            body,
            data: {
              campaignId,
              deliveryStatus: dto.sms ? 'pending' : 'sent',
              smsRequested: !!dto.sms,
            } as any,
          })),
          skipDuplicates: true,
        });
        notified += result.count;
        failed += chunk.length - result.count;
      } catch {
        // fallback per-user
        for (const userId of chunk) {
          try {
            await this.prisma.notification.create({
              data: {
                userId,
                type: 'system' as any,
                title,
                body,
                data: { campaignId, deliveryStatus: dto.sms ? 'pending' : 'sent', smsRequested: !!dto.sms } as any,
              },
            });
            notified++;
          } catch {
            failed++;
          }
        }
      }
    }

    // #82.r2.sms — optional bulk SMS (capped, sequential batches)
    let smsSent = 0;
    let smsFailed = 0;
    let smsSkippedReason: string | undefined;
    if (dto.sms) {
      const envMax = parseInt(process.env.BULK_SMS_MAX || '200', 10);
      const hardMax = Math.min(200, Number.isFinite(envMax) && envMax > 0 ? envMax : 200);
      const maxSms = Math.min(ids.length, hardMax);
      const usersRaw = await this.prisma.user.findMany({
        where: { id: { in: ids.slice(0, maxSms) }, phone: { not: null }, status: UserStatus.active },
        select: { id: true, phone: true },
      });
      // #r4.bugfix — opt-out list in platform_setting (not free-text bio)
      let optOutIds = new Set<string>();
      try {
        const optRow = await this.prisma.platformSetting.findUnique({
          where: { key: 'sms_opt_out_user_ids' },
        });
        const arr = Array.isArray(optRow?.value)
          ? (optRow!.value as unknown[])
          : Array.isArray((optRow?.value as any)?.ids)
            ? (optRow!.value as any).ids
            : [];
        optOutIds = new Set(arr.map((x) => String(x)));
      } catch {
        /* ignore */
      }
      const users = usersRaw.filter((u) => !optOutIds.has(u.id));
      if (users.length < usersRaw.length) {
        smsSkippedReason = (smsSkippedReason ? smsSkippedReason + ',' : '') + 'opt_out_skipped';
      }
      const msg = `${title}
${body}`.slice(0, 400);
      if (ids.length > maxSms) smsSkippedReason = `capped_at_${maxSms}`;
      const concurrency = 10;
      for (let i = 0; i < users.length; i += concurrency) {
        const slice = users.slice(i, i + concurrency);
        const results = await Promise.all(
          slice.map(async (u) => {
            if (!u.phone) return { ok: false as const, id: u.id };
            try {
              await this.sms.sendNotification(u.phone, msg);
              return { ok: true as const, id: u.id };
            } catch (e) {
              this.logger.warn(`bulk SMS fail user=${u.id}: ${e}`);
              return { ok: false as const, id: u.id };
            }
          }),
        );
        for (const r of results) {
          if (r.ok) smsSent++;
          else smsFailed++;
          try {
            await this.prisma.notification.updateMany({
              where: {
                userId: r.id,
                data: { path: ['campaignId'], equals: campaignId },
              },
              data: {
                data: {
                  campaignId,
                  deliveryStatus: r.ok ? 'sent' : 'failed',
                  smsRequested: true,
                  smsDelivered: r.ok,
                } as any,
              },
            });
          } catch {
            /* non-blocking */
          }
        }
      }
    }

    // Persist campaign summary for listCampaigns (survives beyond last 1500 notifs)
    const campaignMeta = {
      campaignId,
      title,
      body,
      createdAt: new Date().toISOString(),
      total: ids.length,
      sent: notified,
      failed,
      smsRequested: !!dto.sms,
      smsSent,
      smsFailed,
      smsSkippedReason,
      actorId: actorId || null,
    };
    try {
      await this.prisma.platformSetting.upsert({
        where: { key: `campaign_meta_${campaignId}` },
        create: { key: `campaign_meta_${campaignId}`, value: campaignMeta as object },
        update: { value: campaignMeta as object },
      });
      // maintain index of recent campaign ids
      const idxKey = 'campaign_index_v1';
      const idxRow = await this.prisma.platformSetting.findUnique({ where: { key: idxKey } });
      const prev = (idxRow?.value as any)?.ids as string[] | undefined;
      const prevIds = Array.isArray(prev) ? prev.filter((x: string) => x !== campaignId) : [];
      const idsList = [campaignId, ...prevIds].slice(0, 500);
      await this.prisma.platformSetting.upsert({
        where: { key: idxKey },
        create: { key: idxKey, value: { ids: idsList } as object },
        update: { value: { ids: idsList } as object },
      });
    } catch {
      /* non-blocking */
    }

    await this.audit(actorId, 'admin.notifications.notify', 'campaign', campaignId, {
      notified,
      failed,
      smsRequested: !!dto.sms,
    });

    return {
      success: true,
      notified,
      smsSent,
      smsSkippedReason,
      campaignId,
      failed,
    };
  }

  @RequirePermissions('admin.notifications.send')
  @Post('notifications/notify-by-filter')
  async notifyByFilter(@Body() dto: NotifyByFilterDto, @CurrentUser('id') actorId?: string) {
    const limit = Math.min(5000, Math.max(1, Number(dto.limit) || 500));
    const filters = dto.filters || {};
    const where: Prisma.UserWhereInput = { status: UserStatus.active };
    const accountType = filters.accountType;
    if (accountType === 'customer' || accountType === 'professional') {
      where.accountType = accountType as any;
    }
    if (filters.neverNotified) where.notifications = { none: {} };
    if (filters.hasPaid) {
      where.bookingsAsCustomer = {
        some: { payment: { is: { status: PaymentStatus.paid } } },
      };
    }
    const users = await this.prisma.user.findMany({
      where,
      take: limit,
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return this.notifyUsers(
      {
        userIds: users.map((u) => u.id),
        title: dto.title,
        body: dto.body,
        sms: dto.sms,
      },
      actorId,
    );
  }

  @RequirePermissions('admin.notifications.send')
  @Get('notifications/campaigns')
  async listCampaigns(@Query('page') pageStr?: string, @Query('limit') limitStr?: string) {
    const page = Math.max(1, Number(pageStr) || 1);
    const limit = Math.min(50, Math.max(1, Number(limitStr) || 20));

    // Prefer campaign index + meta rows (#82.r2.11)
    const idxRow = await this.prisma.platformSetting.findUnique({
      where: { key: 'campaign_index_v1' },
    });
    const ids = ((idxRow?.value as any)?.ids as string[]) || [];
    if (ids.length) {
      const slice = ids.slice((page - 1) * limit, page * limit);
      const metas = await Promise.all(
        slice.map(async (cid) => {
          const row = await this.prisma.platformSetting.findUnique({
            where: { key: `campaign_meta_${cid}` },
          });
          return (row?.value as any) || {
            campaignId: cid,
            title: '',
            body: '',
            createdAt: null,
            total: 0,
            sent: 0,
            failed: 0,
            read: 0,
          };
        }),
      );
      return {
        items: metas,
        meta: {
          page,
          limit,
          total: ids.length,
          totalPages: Math.ceil(ids.length / limit) || 0,
        },
      };
    }

    // Fallback: derive from recent notifications (legacy)
    const rows = await this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1500,
      select: { id: true, title: true, body: true, createdAt: true, readAt: true, data: true },
    });
    const map = new Map<string, any>();
    for (const r of rows) {
      const data = (r.data as any) || {};
      const cid = data.campaignId || `legacy_${r.id}`;
      if (!map.has(cid)) {
        map.set(cid, {
          campaignId: cid,
          title: r.title,
          body: r.body,
          createdAt: r.createdAt,
          total: 0,
          sent: 0,
          failed: 0,
          read: 0,
        });
      }
      const c = map.get(cid);
      c.total++;
      if (data.deliveryStatus === 'failed') c.failed++;
      else c.sent++;
      if (r.readAt) c.read++;
    }
    const all = Array.from(map.values());
    return {
      items: all.slice((page - 1) * limit, page * limit),
      meta: {
        page,
        limit,
        total: all.length,
        totalPages: Math.ceil(all.length / limit) || 0,
      },
    };
  }

  @RequirePermissions('admin.notifications.send')
  @Get('notifications/campaigns/:campaignId')
  async campaignRecipients(
    @Param('campaignId') campaignId: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = Math.max(1, Number(pageStr) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitStr) || 50));
    const where: any = { data: { path: ['campaignId'], equals: campaignId } };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { phone: true, profile: { select: { displayName: true } } } },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      campaignId,
      items: rows.map((r) => {
        const raw = r.user?.phone || '';
        const masked =
          raw.length >= 7 ? raw.slice(0, 4) + '***' + raw.slice(-2) : raw ? '***' : null;
        return {
          id: r.id,
          userId: r.userId,
          phone: masked, // #r4.M2 — never return full phone in campaign lists
          displayName: r.user?.profile?.displayName,
          status:
            (r.data as any)?.deliveryStatus === 'failed'
              ? 'failed'
              : r.readAt
                ? 'read'
                : 'sent',
          createdAt: r.createdAt,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  @RequirePermissions('admin.notifications.send')
  @Post('notifications/campaigns/:campaignId/retry-failed')
  async retryCampaign(
    @Param('campaignId') campaignId: string,
    @CurrentUser('id') actorId?: string,
  ) {
    const failed = await this.prisma.notification.findMany({
      where: {
        AND: [
          { data: { path: ['campaignId'], equals: campaignId } },
          { data: { path: ['deliveryStatus'], equals: 'failed' } },
        ],
      },
      take: 200,
      include: { user: { select: { id: true, phone: true } } },
    });
    let retried = 0;
    let stillFailed = 0;
    const metaRow = await this.prisma.platformSetting.findUnique({
      where: { key: `campaign_meta_${campaignId}` },
    });
    const title = String((metaRow?.value as any)?.title || 'Beautijoo');
    const body = String((metaRow?.value as any)?.body || '');
    const msg = `${title}
${body}`.slice(0, 400);
    for (const n of failed) {
      let ok = false;
      const phone = n.user?.phone;
      if (phone && this.sms?.sendNotification) {
        try {
          await this.sms.sendNotification(phone, msg);
          ok = true;
        } catch (e) {
          this.logger.warn(`retry SMS fail notif=${n.id}: ${e}`);
        }
      }
      try {
        await this.prisma.notification.update({
          where: { id: n.id },
          data: {
            data: {
              ...((n.data as object) || {}),
              campaignId,
              deliveryStatus: ok ? 'sent' : 'failed',
              retriedAt: new Date().toISOString(),
              smsDelivered: ok,
            } as any,
          },
        });
        if (ok) retried++;
        else stillFailed++;
      } catch {
        stillFailed++;
      }
    }
    // Update campaign_meta counters
    if (metaRow?.value) {
      const v = { ...(metaRow.value as any) };
      v.smsSent = Number(v.smsSent || 0) + retried;
      v.smsFailed = stillFailed;
      v.failed = stillFailed;
      v.lastRetryAt = new Date().toISOString();
      await this.prisma.platformSetting
        .update({ where: { key: `campaign_meta_${campaignId}` }, data: { value: v as object } })
        .catch(() => undefined);
    }
    await this.audit(actorId, 'admin.notifications.retry_failed', 'campaign', campaignId, {
      retried,
      stillFailed,
      totalFailed: failed.length,
    });
    return {
      success: true,
      retried,
      stillFailed,
      campaignId,
      totalFailed: failed.length,
    };
  }


  /** Read SMS opt-out user id list (#r4). */
  @RequirePermissions('admin.users.read')
  @Get('sms-opt-out')

  private async mutateSmsOptOut(userId: string, optOut: boolean) {
    const key = 'sms_opt_out_user_ids';
    const MAX = 50_000;
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.platformSetting.findUnique({ where: { key } });
      const prev = Array.isArray(row?.value)
        ? (row!.value as string[])
        : Array.isArray((row?.value as any)?.ids)
          ? ((row!.value as any).ids as string[])
          : [];
      let ids = prev.map(String);
      if (optOut) {
        if (!ids.includes(userId)) ids.push(userId);
      } else {
        ids = ids.filter((x) => x !== userId);
      }
      if (ids.length > MAX) {
        // drop oldest entries (front of array)
        ids = ids.slice(ids.length - MAX);
      }
      await tx.platformSetting.upsert({
        where: { key },
        create: { key, value: ids as any },
        update: { value: ids as any },
      });
      return ids;
    });
  }

  async listSmsOptOut() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'sms_opt_out_user_ids' } });
    const ids = Array.isArray(row?.value)
      ? (row!.value as string[])
      : Array.isArray((row?.value as any)?.ids)
        ? ((row!.value as any).ids as string[])
        : [];
    return { ids };
  }

  /** Add user to SMS opt-out list. */
  @RequirePermissions('admin.users.write')
  @Post('users/:id/sms-opt-out')
  async addSmsOptOut(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('not found');
    const ids = await this.mutateSmsOptOut(id, true);
    await this.audit(actorId, 'admin.sms.opt_out.add', 'user', id, { ids: ids.length });
    return { ok: true, ids };
  }

  /** Remove user from SMS opt-out list. */
  @RequirePermissions('admin.users.write')
  @Post('users/:id/sms-opt-in')
  async removeSmsOptOut(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    const ids = await this.mutateSmsOptOut(id, false);
    await this.audit(actorId, 'admin.sms.opt_out.remove', 'user', id, { ids: ids.length });
    return { ok: true, ids };
  }

  @RequirePermissions('admin.professionals.write')
  @Patch('professionals/:id/feature')
  async setFeaturedAlias(
    @Param('id') id: string,
    @Body() dto: FeaturedDto,
    @CurrentUser('id') actorId?: string,
  ) {
    const pro = await this.prisma.professional.findUnique({ where: { id } });
    if (!pro) throw new NotFoundException('not found');
    const updated = await this.prisma.professional.update({
      where: { id },
      data: { isFeatured: !!dto.isFeatured },
    });
    await this.audit(actorId, 'admin.professional.featured', 'professional', id, {
      isFeatured: !!dto.isFeatured,
    });
    return updated;
  }

  @RequirePermissions('admin.professionals.write')
  @Post('professionals/create')
  async createProfessional(
    @Body() body: { phone: string; title?: string; displayName?: string; firstName?: string; lastName?: string },
    @CurrentUser('id') actorId?: string,
  ) {
    const phone = normalizeIranPhone(body.phone || '');
    if (!phone || phone.length < 10) throw new BadRequestException('موبایل الزامی است');
    let user: any = await this.prisma.user.findFirst({
      where: { phone, accountType: 'professional' as any },
      include: { professional: true, profile: true },
    });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone,
          accountType: 'professional' as any,
          status: 'active' as any,
          profile: {
            create: {
              displayName: (body.displayName || body.title || body.firstName || phone).trim(),
              firstName: body.firstName?.trim() || null,
              lastName: body.lastName?.trim() || null,
            },
          },
        },
        include: { professional: true, profile: true },
      });
      try {
        const role = await this.prisma.role.findUnique({ where: { name: 'professional' } });
        if (role) {
          await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
        }
      } catch {
        /* non-blocking */
      }
    }
    if (user.professional) return user.professional;
    const baseSlug =
      (body.title || body.displayName || phone)
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0600-\u06FF-]+/g, '')
        .slice(0, 40) || 'pro';
    let slug = baseSlug;
    for (let i = 0; i < 5; i++) {
      const taken = await this.prisma.professional.findUnique({ where: { slug } });
      if (!taken) break;
      slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
    }
    const pro = await this.prisma.professional.create({
      data: {
        userId: user.id,
        slug,
        title: (body.title || body.displayName || 'زیباگر').trim(),
        status: 'draft' as any,
      },
    });
    await this.audit(actorId, 'professional.create', 'professional', pro.id, { phone, slug });
    return pro;
  }
}
