import { Body, Controller, Get, Param, Patch, Post, Put, Query, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaymentStatus, UserStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateCustomerDto { @IsString() phone!: string; @IsOptional() @IsString() displayName?: string; @IsOptional() @IsString() firstName?: string; @IsOptional() @IsString() lastName?: string; }
class UpdateUserProfileDto { @IsOptional() @IsString() displayName?: string; @IsOptional() @IsString() firstName?: string; @IsOptional() @IsString() lastName?: string; @IsOptional() @IsString() phone?: string; }
class NotifyUsersDto { @IsArray() @IsString({ each: true }) userIds!: string[]; @IsString() title!: string; @IsString() body!: string; @IsOptional() @IsBoolean() sms?: boolean; }
class NotifyByFilterDto { @IsString() title!: string; @IsString() body!: string; @IsOptional() @IsBoolean() sms?: boolean; @IsOptional() @IsNumber() limit?: number; @IsOptional() filters?: Record<string, unknown>; }
class FeaturedDto { @IsBoolean() isFeatured!: boolean; }

@ApiTags('admin-ops')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'admin')
@Controller('admin')
export class AdminOpsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('content')
  async getContent() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_content' } });
    return (row?.value as object) ?? { hero: {}, texts: {}, features: {} };
  }

  @Put('content')
  async putContent(@Body() body: any) {
    const value = { hero: body?.hero ?? {}, texts: body?.texts ?? {}, features: body?.features ?? {} } as any;
    await this.prisma.platformSetting.upsert({ where: { key: 'site_cms_content' }, create: { key: 'site_cms_content', value }, update: { value } });
    return value;
  }

  @Get('site-builder')
  async getSiteBuilder() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'site_cms_sections' } });
    const val = row?.value as any;
    if (Array.isArray(val)) return val;
    return Array.isArray(val?.sections) ? val.sections : [];
  }

  @Put('site-builder')
  async putSiteBuilder(@Body() body: any) {
    const list = Array.isArray(body) ? body : body?.sections ?? [];
    await this.prisma.platformSetting.upsert({ where: { key: 'site_cms_sections' }, create: { key: 'site_cms_sections', value: list as any }, update: { value: list as any } });
    return list;
  }

  @Post('users')
  async createCustomer(@Body() dto: CreateCustomerDto) {
    const phone = String(dto.phone || '').trim();
    if (!phone) throw new BadRequestException('phone required');
    if (await this.prisma.user.findFirst({ where: { phone } })) throw new ConflictException('phone exists');
    return this.prisma.user.create({
      data: {
        phone, accountType: 'customer' as any, status: UserStatus.active,
        profile: { create: { displayName: (dto.displayName || dto.firstName || phone).trim(), firstName: dto.firstName?.trim() || null, lastName: dto.lastName?.trim() || null } },
      },
      include: { profile: true, userRoles: { include: { role: true } } },
    });
  }

  @Patch('users/:id/profile')
  async updateUserProfile(@Param('id') id: string, @Body() dto: UpdateUserProfileDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('not found');
    if (dto.phone?.trim() && dto.phone.trim() !== existing.phone) {
      if (await this.prisma.user.findFirst({ where: { phone: dto.phone.trim(), NOT: { id } } })) throw new ConflictException('phone exists');
      await this.prisma.user.update({ where: { id }, data: { phone: dto.phone.trim() } });
    }
    const profileData: any = {};
    if (dto.displayName !== undefined) profileData.displayName = dto.displayName.trim() || existing.phone || 'User';
    if (dto.firstName !== undefined) profileData.firstName = dto.firstName.trim() || null;
    if (dto.lastName !== undefined) profileData.lastName = dto.lastName.trim() || null;
    if (Object.keys(profileData).length) {
      await this.prisma.profile.upsert({
        where: { userId: id }, update: profileData,
        create: { userId: id, displayName: profileData.displayName || existing.phone || 'User', firstName: profileData.firstName ?? null, lastName: profileData.lastName ?? null },
      });
    }
    return this.prisma.user.findUnique({ where: { id }, include: { profile: true, userRoles: { include: { role: true } } } });
  }

  @Post('notifications/notify')
  async notifyUsers(@Body() dto: NotifyUsersDto) {
    const title = String(dto.title || '').trim();
    const body = String(dto.body || '').trim();
    if (!title || !body) throw new BadRequestException('title/body required');
    const ids = Array.from(new Set((dto.userIds || []).filter(Boolean)));
    const campaignId = `cmp_${Date.now().toString(36)}`;
    let notified = 0, failed = 0;
    for (const userId of ids) {
      try {
        await this.prisma.notification.create({ data: { userId, type: 'system' as any, title, body, data: { campaignId } } });
        notified++;
      } catch { failed++; }
    }
    return { success: true, notified, smsSent: 0, campaignId, failed };
  }

  @Post('notifications/notify-by-filter')
  async notifyByFilter(@Body() dto: NotifyByFilterDto) {
    const limit = Math.min(5000, Math.max(1, Number(dto.limit) || 500));
    const filters = dto.filters || {};
    const where: Prisma.UserWhereInput = {};
    if (filters.neverNotified) where.notifications = { none: {} };
    if (filters.hasPaid) where.bookingsAsCustomer = { some: { payment: { is: { status: PaymentStatus.paid } } } };
    const users = await this.prisma.user.findMany({ where, take: limit, select: { id: true } });
    return this.notifyUsers({ userIds: users.map(u => u.id), title: dto.title, body: dto.body, sms: dto.sms });
  }

  @Get('notifications/campaigns')
  async listCampaigns(@Query('page') pageStr?: string, @Query('limit') limitStr?: string) {
    const page = Math.max(1, Number(pageStr) || 1);
    const limit = Math.min(50, Math.max(1, Number(limitStr) || 20));
    const rows = await this.prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 1500, select: { id: true, title: true, body: true, createdAt: true, readAt: true, data: true } });
    const map = new Map<string, any>();
    for (const r of rows) {
      const cid = (r.data as any)?.campaignId || `legacy_${r.id}`;
      if (!map.has(cid)) map.set(cid, { campaignId: cid, title: r.title, body: r.body, createdAt: r.createdAt, total: 0, sent: 0, failed: 0, read: 0 });
      const c = map.get(cid); c.total++; c.sent++; if (r.readAt) c.read++;
    }
    const all = Array.from(map.values());
    return { items: all.slice((page - 1) * limit, page * limit), meta: { page, limit, total: all.length, totalPages: Math.ceil(all.length / limit) || 0 } };
  }

  @Get('notifications/campaigns/:campaignId')
  async campaignRecipients(@Param('campaignId') campaignId: string, @Query('page') pageStr?: string, @Query('limit') limitStr?: string) {
    const page = Math.max(1, Number(pageStr) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitStr) || 50));
    const where: any = { data: { path: ['campaignId'], equals: campaignId } };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({ where, skip: (page - 1) * limit, take: limit, include: { user: { select: { phone: true, profile: { select: { displayName: true } } } } } }),
      this.prisma.notification.count({ where }),
    ]);
    return { campaignId, items: rows.map(r => ({ id: r.id, userId: r.userId, phone: r.user?.phone, displayName: r.user?.profile?.displayName, status: r.readAt ? 'read' : 'sent', createdAt: r.createdAt })), meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  @Post('notifications/campaigns/:campaignId/retry-failed')
  retryCampaign(@Param('campaignId') campaignId: string) {
    return { success: true, retried: 0, campaignId, totalFailed: 0 };
  }

  @Patch('professionals/:id/feature')
  async setFeaturedAlias(@Param('id') id: string, @Body() dto: FeaturedDto) {
    const pro = await this.prisma.professional.findUnique({ where: { id } });
    if (!pro) throw new NotFoundException('not found');
    return this.prisma.professional.update({ where: { id }, data: { isFeatured: !!dto.isFeatured } });
  }
}
