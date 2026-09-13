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
  ArrayMaxSize,
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
  @ApiProperty()
  @IsString()
  status: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

class UserRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  roles: string[];
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

class ReviewVisibilityDto {
  @ApiProperty()
  @IsBoolean()
  isPublished: boolean;
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

class FeatureDto {
  @ApiProperty()
  @IsBoolean()
  isFeatured: boolean;
}

class BroadcastNotificationDto {
  @ApiProperty()
  @IsString()
  title: string;
  @ApiProperty()
  @IsString()
  body: string;
  @ApiProperty({ enum: ['all', 'professionals', 'customers'] })
  @IsString()
  target: 'all' | 'professionals' | 'customers';
}

class NotifyUsersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  userIds: string[];
  @ApiProperty()
  @IsString()
  title: string;
  @ApiProperty()
  @IsString()
  body: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sms?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  campaignId?: string;
}

class NotifyByFilterDto {
  @ApiProperty()
  @IsString()
  title: string;
  @ApiProperty()
  @IsString()
  body: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sms?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number;
  @ApiPropertyOptional()
  @IsOptional()
  filters?: Record<string, unknown>;
}

class UpdateCommissionRateDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(100)
  rate: number;
}

class UpdateFailedThresholdDto {
  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Max(1000)
  threshold: number;
}

class FinancialQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  page?: string;
  @ApiPropertyOptional()
  @IsOptional()
  limit?: string;
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provider?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;
  @ApiPropertyOptional()
  @IsOptional()
  sortBy?: 'createdAt' | 'paidAt' | 'amount';
  @ApiPropertyOptional()
  @IsOptional()
  sortOrder?: 'asc' | 'desc';
}

class CatalogCategoryDto {
  @ApiProperty()
  @IsString()
  name: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class CatalogCategoryPatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  parentId?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;
  @ApiPropertyOptional()
  @IsOptional()
  description?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class CatalogServiceDto {
  @ApiProperty()
  @IsString()
  name: string;
  @ApiProperty()
  @IsString()
  categoryId: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class CatalogServicePatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;
  @ApiPropertyOptional()
  @IsOptional()
  description?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('stats')
  stats() {
    return this.service.stats();
  }

  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Get('finance/summary')
  financeSummary(@Query('period') period?: 'today' | 'this_month' | 'all_time') {
    return this.service.getFinancialSummary(period || 'all_time');
  }

  @Get('finance/transactions')
  financeTransactions(@Query() query: FinancialQueryDto) {
    return this.service.listFinancialTransactions({
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      status: query.status,
      provider: query.provider,
      search: query.search,
      startDate: query.startDate,
      endDate: query.endDate,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
  }

  @Get('finance/transactions/:id')
  financeTransactionDetail(@Param('id') id: string) {
    return this.service.getFinancialTransactionDetail(id);
  }

  @Get('finance/settings/commission')
  getCommissionRate() {
    return this.service.getCommissionSetting();
  }

  @Post('finance/settings/commission')
  updateCommissionRate(@Body() dto: UpdateCommissionRateDto, @CurrentUser('id') adminUserId?: string) {
    return this.service.updateCommissionSetting(dto.rate, adminUserId);
  }

  @Get('finance/failed-alert')
  getFailedTransactionsAlert() {
    return this.service.getFailedTransactionsAlert();
  }

  @Post('finance/failed-alert/threshold')
  updateFailedTransactionsThreshold(@Body() dto: UpdateFailedThresholdDto, @CurrentUser('id') adminUserId?: string) {
    return this.service.updateFailedTransactionsThreshold(dto.threshold, adminUserId);
  }

  @Get('users')
  listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: UserStatus,
    @Query('role') role?: string,
    @Query('accountType') accountType?: string,
    @Query('city') city?: string,
    @Query('bookingPresence') bookingPresence?: 'any' | 'none' | 'has',
    @Query('bookingStatus') bookingStatus?: string,
    @Query('registeredFrom') registeredFrom?: string,
    @Query('registeredTo') registeredTo?: string,
    @Query('neverNotified') neverNotified?: string,
    @Query('hasPaid') hasPaid?: string,
  ) {
    return this.service.listUsers({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      role,
      accountType: accountType || 'customer',
      city,
      bookingPresence,
      bookingStatus,
      registeredFrom,
      registeredTo,
      neverNotified,
      hasPaid,
    });
  }

  @Get('customers/stats')
  customersStats() {
    return this.service.getCustomersStats();
  }

  @Get('users/:id')
  getUserDetail(@Param('id') id: string) {
    return this.service.getUserDetail(id);
  }

  @Patch('users/:id/status')
  setUserStatus(@Param('id') id: string, @Body() dto: UserStatusDto, @CurrentUser('id') actorId?: string) {
    return this.service.setUserStatus(id, dto.status, actorId, dto.reason);
  }

  @Patch('users/:id/roles')
  setUserRoles(@Param('id') id: string, @Body() dto: UserRolesDto, @CurrentUser('id') actorId?: string) {
    return this.service.setUserRoles(id, dto.roles, actorId);
  }

  @Post('users')
  createCustomer(
    @Body() dto: { phone: string; displayName?: string; firstName?: string; lastName?: string },
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.createCustomer(dto, actorId);
  }

  @Patch('users/:id/profile')
  updateUserProfile(
    @Param('id') id: string,
    @Body() dto: { displayName?: string; firstName?: string; lastName?: string; phone?: string },
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.updateUserProfile(id, dto, actorId);
  }

  @Delete('users/:id')
  hardDeleteUser(
    @Param('id') id: string,
    @Body() dto: { reason?: string },
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.hardDeleteUser(id, actorId, dto?.reason);
  }

  @Post('users/bulk-delete')
  bulkHardDeleteUsers(
    @Body() dto: { userIds: string[]; reason?: string },
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.bulkHardDeleteUsers(dto.userIds || [], actorId, dto.reason);
  }

  @Get('professionals')
  listPros(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: ProfessionalStatus,
    @Query('isFeatured') isFeatured?: string,
  ) {
    return this.service.listProfessionals({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
    });
  }

  @Get('professionals/:id')
  getProDetail(@Param('id') id: string) {
    return this.service.getProfessionalDetail(id);
  }

  @Patch('professionals/:id/profile')
  updateProProfile(
    @Param('id') id: string,
    @Body() dto: { title?: string; bio?: string; isFeatured?: boolean },
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.updateProfessional(id, dto, actorId);
  }

  @Patch('professionals/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: StatusDto, @CurrentUser('id') actorId?: string) {
    return this.service.setProfessionalStatus(id, dto.status, actorId, dto.reason);
  }

  @Patch('professionals/:id/feature')
  setFeatured(@Param('id') id: string, @Body() dto: FeatureDto, @CurrentUser('id') actorId?: string) {
    return this.service.setProfessionalFeatured(id, dto.isFeatured, actorId);
  }

  @Get('bookings-stats')
  @ApiOperation({ summary: 'Booking KPI cards' })
  bookingsStats() {
    return this.service.getBookingsStats();
  }

  @Get('bookings')
  listBookings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: BookingStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('paymentStatus') paymentStatus?: PaymentStatus,
  ) {
    return this.service.listBookings({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      startDate,
      endDate,
      paymentStatus,
    });
  }

  @Get('bookings/:id')
  getBookingDetail(@Param('id') id: string) {
    return this.service.getBookingDetail(id);
  }

  @Patch('bookings/:id/status')
  updateBookingStatus(@Param('id') id: string, @Body() dto: BookingStatusDto, @CurrentUser('id') actorId?: string) {
    return this.service.updateBookingStatus(id, dto.status, actorId, dto.reason);
  }

  @Get('reviews')
  listReviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('rating') rating?: string,
    @Query('isPublished') isPublished?: string,
  ) {
    return this.service.listReviews({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      rating: rating ? parseInt(rating, 10) : undefined,
      isPublished: isPublished !== undefined ? isPublished === 'true' : undefined,
    });
  }

  @Patch('reviews/:id/visibility')
  setReviewVisibility(@Param('id') id: string, @Body() dto: ReviewVisibilityDto, @CurrentUser('id') actorId?: string) {
    return this.service.setReviewVisibility(id, dto.isPublished, actorId, dto.reason);
  }

  @Delete('reviews/:id')
  deleteReview(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.service.deleteReview(id, actorId);
  }

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

  @Patch('media/:id/status')
  setMediaStatus(@Param('id') id: string, @Body() dto: MediaStatusDto, @CurrentUser('id') actorId?: string) {
    return this.service.setMediaStatus(id, dto.status, actorId);
  }

  @Delete('media/:id')
  deleteMedia(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.service.deleteMedia(id, actorId);
  }

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

  @Post('notifications/broadcast')
  broadcastNotification(@Body() dto: BroadcastNotificationDto, @CurrentUser('id') actorId?: string) {
    return this.service.broadcastNotification(dto, actorId);
  }

  @Post('notifications/notify')
  notifyUsers(@Body() dto: NotifyUsersDto, @CurrentUser('id') actorId?: string) {
    return this.service.notifyUsers(dto, actorId);
  }

  @Post('notifications/notify-by-filter')
  notifyByFilter(@Body() dto: NotifyByFilterDto, @CurrentUser('id') actorId?: string) {
    return this.service.notifyByFilter(dto, actorId);
  }

  @Get('notifications/campaigns')
  listCampaigns(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listNotificationCampaigns({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
    });
  }

  @Get('notifications/campaigns/:campaignId')
  campaignRecipients(
    @Param('campaignId') campaignId: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getCampaignRecipients(campaignId, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Post('notifications/campaigns/:campaignId/retry-failed')
  retryFailed(@Param('campaignId') campaignId: string, @CurrentUser('id') actorId?: string) {
    return this.service.retryFailedCampaign(campaignId, actorId);
  }

  @Get('settings')
  getSettings() {
    return this.service.getPlatformSettings();
  }

  @Put('settings/:group')
  updateSettings(@Param('group') group: string, @Body() values: Record<string, any>, @CurrentUser('id') actorId?: string) {
    return this.service.updatePlatformSettingsGroup(group, values, actorId);
  }

  @Get('content')
  getContent() {
    return this.service.getCMSContent();
  }

  @Put('content')
  updateContent(@Body() content: Record<string, any>, @CurrentUser('id') actorId?: string) {
    return this.service.updateCMSContent(content, actorId);
  }

  @Get('site-builder')
  getSiteBuilder() {
    return this.service.getSiteBuilder();
  }

  @Put('site-builder')
  updateSiteBuilder(@Body() sections: any[], @CurrentUser('id') actorId?: string) {
    return this.service.updateSiteBuilder(sections, actorId);
  }

  @Get('roles')
  listRoles() {
    return this.service.listRoles();
  }

  @Get('permissions')
  listPermissions() {
    return this.service.listPermissions();
  }

  @Get('service-categories')
  listServiceCategories() {
    return this.service.listServiceCategories();
  }

  @Post('service-categories')
  createServiceCategory(@Body() dto: CatalogCategoryDto, @CurrentUser('id') actorId?: string) {
    return this.service.createServiceCategory(dto, actorId);
  }

  @Patch('service-categories/:id')
  updateServiceCategory(
    @Param('id') id: string,
    @Body() dto: CatalogCategoryPatchDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.updateServiceCategory(id, dto, actorId);
  }

  @Delete('service-categories/:id')
  deleteServiceCategory(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.service.deleteServiceCategory(id, actorId);
  }

  @Get('catalog-services')
  listCatalogServices() {
    return this.service.listCatalogServices();
  }

  @Post('catalog-services')
  createCatalogService(@Body() dto: CatalogServiceDto, @CurrentUser('id') actorId?: string) {
    return this.service.createCatalogService(dto, actorId);
  }

  @Patch('catalog-services/:id')
  updateCatalogService(
    @Param('id') id: string,
    @Body() dto: CatalogServicePatchDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.updateCatalogService(id, dto, actorId);
  }

  @Delete('catalog-services/:id')
  deleteCatalogService(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.service.deleteCatalogService(id, actorId);
  }

  @Get('service-category-requests')
  listServiceCategoryRequests(@Query('status') status?: string) {
    return this.service.listServiceCategoryRequests(status);
  }

  @Patch('service-category-requests/:professionalServiceId/:categoryId')
  reviewServiceCategoryRequest(
    @Param('professionalServiceId') professionalServiceId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: { status: string },
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.reviewServiceCategoryRequest(professionalServiceId, categoryId, dto.status, actorId);
  }

  @Post('services/:serviceId/filter-categories')
  assignFilterCategory(
    @Param('serviceId') serviceId: string,
    @Body() dto: { categoryId: string },
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.assignServiceFilterCategory(serviceId, dto.categoryId, actorId);
  }
}
