import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_PLATFORM_SETTINGS,
  PLATFORM_SETTINGS_KEY,
  mergePlatformSettings,
  type PlatformSettingsV1,
} from './platform-settings.defaults';
import { BookingStatus, MediaStatus, ProfessionalStatus } from '@prisma/client';

@ApiTags('admin-settings')
@ApiBearerAuth()
@Controller('admin')
export class AdminSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Unread / unreviewed counts for admin sidebar badges (issue #35). */
  @RequirePermissions('admin.dashboard.read')
  @Get('nav-badges')
  @ApiOperation({ summary: 'Pending counts for admin nav badges' })
  async navBadges() {
    const [professionals, bookings, reviews, support, media] = await Promise.all([
      this.prisma.professional.count({
        where: { status: ProfessionalStatus.pending_review },
      }),
      this.prisma.booking.count({
        where: { status: BookingStatus.pending },
      }),
      this.prisma.review.count({ where: { isPublished: false } }),
      this.prisma.supportTicket.count({
        where: { status: { in: ['open', 'pending'] } },
      }),
      this.prisma.mediaAsset.count({ where: { status: MediaStatus.draft } }),
    ]);
    return {
      professionals,
      bookings,
      reviews,
      support,
      media,
      notifications: 0,
    };
  }

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
  async putSettings(@Body() body: Partial<PlatformSettingsV1>) {
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
    return next;
  }

  @RequirePermissions('admin.settings.read')
  @Get('settings/defaults')
  defaults() {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}
