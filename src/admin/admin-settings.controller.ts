import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_PLATFORM_SETTINGS,
  PLATFORM_SETTINGS_KEY,
  mergePlatformSettings,
  type PlatformSettingsV1,
} from './platform-settings.defaults';

@ApiTags('admin-settings')
@ApiBearerAuth()
@Controller('admin')
export class AdminSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @RequirePermissions('admin.settings.read')
  @Get('settings')
  @ApiOperation({ summary: 'Get hierarchical platform settings' })
  async getSettings() {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: PLATFORM_SETTINGS_KEY },
    });
    return mergePlatformSettings(row?.value);
  }

  @RequirePermissions('admin.settings.write')
  @Put('settings')
  @ApiOperation({ summary: 'Update platform settings (partial groups allowed)' })
  async putSettings(
    @Body() body: Partial<PlatformSettingsV1>,
    @CurrentUser('id') actorId?: string,
  ) {
    // #82.r2.4 — validate commission.ratePercent
    if (body.commission?.ratePercent != null) {
      const rate = Number(body.commission.ratePercent);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        throw new BadRequestException('نرخ کمیسیون باید بین ۰ تا ۱۰۰ باشد');
      }
      body = {
        ...body,
        commission: { ...body.commission, ratePercent: rate },
      };
    }

    const current = await this.getSettings();
    const next = mergePlatformSettings({
      ...current,
      ...body,
      booking: { ...current.booking, ...(body.booking || {}) },
      commission: { ...current.commission, ...(body.commission || {}) },
      professionals: { ...current.professionals, ...(body.professionals || {}) },
      reviews: { ...current.reviews, ...(body.reviews || {}) },
      search: { ...current.search, ...(body.search || {}) },
      auth: { ...current.auth, ...(body.auth || {}) },
      privacy: { ...current.privacy, ...(body.privacy || {}) },
      public: { ...current.public, ...(body.public || {}) },
    });
    await this.prisma.platformSetting.upsert({
      where: { key: PLATFORM_SETTINGS_KEY },
      create: { key: PLATFORM_SETTINGS_KEY, value: next as object },
      update: { value: next as object },
    });
    if (body.commission?.ratePercent != null) {
      const rate = body.commission.ratePercent;
      await this.prisma.platformSetting.upsert({
        where: { key: 'commission_rate' },
        create: { key: 'commission_rate', value: rate as unknown as object },
        update: { value: rate as unknown as object },
      });
    }
    // #82.r2.4 — audit settings changes
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action: 'admin.settings.update',
          entityType: 'platform_setting',
          entityId: PLATFORM_SETTINGS_KEY,
          after: body as object,
        },
      });
    } catch {
      /* non-blocking */
    }
    return next;
  }

  @RequirePermissions('admin.settings.read')
  @Get('settings/defaults')
  defaults() {
    return DEFAULT_PLATFORM_SETTINGS;
  }

  @RequirePermissions('admin.settings.read')
  @Get('events')
  @ApiOperation({ summary: 'List marketing/site events (#65.10)' })
  async getEvents() {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: 'marketing_events_v1' },
    });
    const value = row?.value as { items?: unknown[] } | null;
    return { items: Array.isArray(value?.items) ? value!.items : [] };
  }

  @RequirePermissions('admin.settings.write')
  @Put('events')
  @ApiOperation({ summary: 'Replace marketing/site events list (#65.10)' })
  async putEvents(
    @Body() body: { items?: Array<Record<string, unknown>> },
    @CurrentUser('id') actorId?: string,
  ) {
    const items = Array.isArray(body?.items) ? body.items.slice(0, 100) : [];
    const value = { items };
    await this.prisma.platformSetting.upsert({
      where: { key: 'marketing_events_v1' },
      create: { key: 'marketing_events_v1', value: value as object },
      update: { value: value as object },
    });
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action: 'admin.events.update',
          entityType: 'platform_setting',
          entityId: 'marketing_events_v1',
          after: { count: items.length } as object,
        },
      });
    } catch {
      /* non-blocking */
    }
    return { items };
  }
}
