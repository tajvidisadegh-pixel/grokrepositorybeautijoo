import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  ProfessionalStatus,
  PaymentStatus,
  UserStatus,
  BookingStatus,
  MediaKind,
  MediaStatus,
  NotificationType,
} from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

class StatusDto {
  @ApiProperty({ enum: ProfessionalStatus })
  @IsEnum(ProfessionalStatus)
  status: ProfessionalStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

class UserStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus)
  status: UserStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

class BookingStatusDto {
  @ApiProperty({ enum: BookingStatus })
  @IsEnum(BookingStatus)
  status: BookingStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

class MediaStatusDto {
  @ApiProperty({ enum: MediaStatus })
  @IsEnum(MediaStatus)
  status: MediaStatus;
}

class CommissionDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  rate: number;
}

class FeaturedDto {
  @ApiProperty()
  @IsBoolean()
  isFeatured: boolean;
}

class RolesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  roles: string[];
}

class BulkDeleteUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  userIds!: string[];
}

class ReviewPublishDto {
  @ApiProperty({ description: 'true = published, false = hidden' })
  @IsBoolean()
  isPublished!: boolean;
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @RequirePermissions('admin.dashboard.read')
  @Get('stats')
  stats() {
    return this.service.stats();
  }

  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @RequirePermissions('admin.finance.read')
  @Get('finance/summary')
  financeSummary(@Query('period') period?: string) {
    return this.service.getFinancialSummary(period);
  }

  @RequirePermissions('admin.finance.read')
  @Get('finance/transactions')
  financeTransactions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: PaymentStatus,
    @Query('search') search?: string,
  ) {
    return this.service.listFinancialTransactions({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status,
      search,
    });
  }

  @RequirePermissions('admin.finance.read')
  @Get('finance/transactions/:id')
  financeTransactionDetail(@Param('id') id: string) {
    return this.service.getFinancialTransactionDetail(id);
  }

  @RequirePermissions('admin.finance.read')
  @Get('finance/settings/commission')
  getCommission() {
    return this.service.getCommissionSetting();
  }

  @RequirePermissions('admin.finance.write')
  @Put('finance/settings/commission')
  setCommission(@Body() dto: CommissionDto, @CurrentUser('id') actorId?: string) {
    return this.service.updateCommissionSetting(dto.rate, actorId);
  }

  @RequirePermissions('admin.finance.read')
  @Get('finance/failed-alert')
  failedAlert() {
    return this.service.getFailedTransactionsAlert();
  }

  @RequirePermissions('admin.finance.write')
  @Post('finance/settings/commission')
  setCommissionPost(@Body() dto: CommissionDto, @CurrentUser('id') actorId?: string) {
    return this.service.updateCommissionSetting(dto.rate, actorId);
  }

  @RequirePermissions('admin.finance.write')
  @Post('finance/failed-alert/threshold')
  setFailedThreshold(@Body() body: { threshold?: number }, @CurrentUser('id') actorId?: string) {
    return this.service.setFailedTransactionsThreshold(Number(body?.threshold ?? 0), actorId);
  }

  @RequirePermissions('admin.users.read')
  @Get('users')
  listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: UserStatus,
    @Query('role') role?: string,
  ) {
    return this.service.listUsers({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      role,
    });
  }

  @RequirePermissions('admin.users.read')
  @Get('customers/stats')
  customersStats() {
    return this.service.getCustomersStats();
  }

  @RequirePermissions('admin.users.read')
  @Get('users/:id')
  userDetail(@Param('id') id: string) {
    return this.service.getUserDetail(id);
  }

  
  @Post('users/:id/impersonate')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Impersonate customer (SUPER_ADMIN only)' })
  impersonateCustomer(
    @CurrentUser('id') adminId: string,
    @Param('id') customerId: string,
  ) {
    return this.service.impersonateCustomer(adminId, customerId);
  }

  @RequirePermissions('admin.users.write')
  @Patch('users/:id/status')
  setUserStatus(@Param('id') id: string, @Body() dto: UserStatusDto, @CurrentUser('id') actorId?: string) {
    return this.service.setUserStatus(id, dto.status, actorId, dto.reason);
  }

  @RequirePermissions('admin.users.write')
  @Patch('users/:id/roles')
  setUserRoles(@Param('id') id: string, @Body() dto: RolesDto, @CurrentUser('id') actorId?: string) {
    return this.service.setUserRoles(id, dto.roles, actorId);
  }

  @RequirePermissions('admin.users.write')
  @Delete('users/:id')
  hardDeleteUser(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.service.hardDeleteUser(id, actorId);
  }

  @RequirePermissions('admin.users.write')
  @Post('users/bulk-delete')
  bulkHardDeleteUsers(@Body() dto: BulkDeleteUsersDto, @CurrentUser('id') actorId?: string) {
    return this.service.bulkHardDeleteUsers(dto.userIds, actorId);
  }

  @RequirePermissions('admin.professionals.write')
  @Delete('professionals/:id')
  hardDeleteProfessional(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.service.hardDeleteProfessional(id, actorId);
  }

  @RequirePermissions('admin.professionals.read')
  @Get('professionals')
  listProfessionals(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: ProfessionalStatus,
  ) {
    return this.service.listProfessionals({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
    });
  }

  @RequirePermissions('admin.professionals.read')
  @Get('professionals/:id')
  professionalDetail(@Param('id') id: string) {
    return this.service.getProfessionalDetail(id);
  }

  @RequirePermissions('admin.professionals.write')
  @Patch('professionals/:id/status')
  setProfessionalStatus(@Param('id') id: string, @Body() dto: StatusDto, @CurrentUser('id') actorId?: string) {
    return this.service.setProfessionalStatus(id, dto.status, actorId, dto.reason);
  }

  @RequirePermissions('admin.professionals.write')
  @Patch('professionals/:id/featured')
  setFeatured(@Param('id') id: string, @Body() dto: FeaturedDto, @CurrentUser('id') actorId?: string) {
    return this.service.setProfessionalFeatured(id, dto.isFeatured, actorId);
  }

  @RequirePermissions('admin.bookings.read')
  @Get('bookings-stats')
  bookingsStats() {
    return this.service.getBookingsStats();
  }

  @RequirePermissions('admin.bookings.read')
  @Get('bookings')
  listBookings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: BookingStatus,
    @Query('paymentStatus') paymentStatus?: PaymentStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.listBookings({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      paymentStatus,
      startDate,
      endDate,
    });
  }

  @RequirePermissions('admin.bookings.read')
  @Get('bookings/:id')
  bookingDetail(@Param('id') id: string) {
    return this.service.getBookingDetail(id);
  }

  @RequirePermissions('admin.bookings.write')
  @Patch('bookings/:id/status')
  updateBookingStatus(@Param('id') id: string, @Body() dto: BookingStatusDto, @CurrentUser('id') actorId?: string) {
    return this.service.updateBookingStatus(id, dto.status, actorId, dto.reason);
  }

  @RequirePermissions('admin.reviews.moderate')
  @Get('reviews')
  listReviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isPublished') isPublished?: string,
  ) {
    let publishedFilter: boolean | undefined;
    if (isPublished === 'true') publishedFilter = true;
    else if (isPublished === 'false') publishedFilter = false;
    return this.service.listReviews({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      isPublished: publishedFilter,
    });
  }

  @RequirePermissions('admin.reviews.moderate')
  @Patch('reviews/:id/publish')
  @ApiOperation({ summary: 'Publish or hide a review' })
  setReviewPublished(
    @Param('id') id: string,
    @Body() dto: ReviewPublishDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.setReviewPublished(id, dto.isPublished, actorId);
  }

  @RequirePermissions('admin.reviews.moderate')
  @Delete('reviews/:id')
  @ApiOperation({ summary: 'Delete a review and recalc professional rating' })
  deleteReview(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.service.deleteReview(id, actorId);
  }

  @RequirePermissions('admin.media.moderate')
  @Get('media')
  listMedia(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('kind') kind?: MediaKind,
    @Query('status') status?: MediaStatus,
    @Query('professionalId') professionalId?: string,
  ) {
    return this.service.listMedia({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 24,
      search,
      kind,
      status,
      professionalId,
    });
  }

  @RequirePermissions('admin.media.moderate')
  @Get('media-stats')
  @ApiOperation({ summary: 'Media KPI cards' })
  mediaStats() {
    return this.service.getMediaStats();
  }

  @RequirePermissions('admin.media.moderate')
  @Patch('media/:id/status')
  setMediaStatus(@Param('id') id: string, @Body() dto: MediaStatusDto, @CurrentUser('id') actorId?: string) {
    return this.service.setMediaStatus(id, dto.status, actorId);
  }

  @RequirePermissions('admin.media.moderate')
  @Delete('media/:id')
  deleteMedia(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.service.deleteMedia(id, actorId);
  }

  @RequirePermissions('admin.audit.read')
  @Get('audit-logs')
  auditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.listAuditLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      action,
      actorId,
      entityType,
      entityId,
      startDate,
      endDate,
    });
  }

  @RequirePermissions('admin.notifications.send')
  @Get('notifications')
  listNotifications(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: NotificationType,
    @Query('search') search?: string,
  ) {
    return this.service.listNotifications({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 30,
      type,
      search,
    });
  }
  /** Platform rules - SUPER_ADMIN only */
  @Roles('SUPER_ADMIN')
  @Get('settings')
  @ApiOperation({ summary: 'Get platform settings (SUPER_ADMIN)' })
  getSettings() {
    return this.service.getPlatformSettings();
  }

  @Roles('SUPER_ADMIN')
  @Put('settings')
  @ApiOperation({ summary: 'Update platform settings section(s) (SUPER_ADMIN)' })
  updateSettings(
    @Body() body: Record<string, unknown>,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.updatePlatformSettings(body || {}, actorId);
  }

  @RequirePermissions('admin.dashboard.read')
  @Get('nav-badges')
  @ApiOperation({ summary: 'Counts for admin sidebar badges' })
  navBadges() {
    return this.service.getNavBadges();
  }

}
