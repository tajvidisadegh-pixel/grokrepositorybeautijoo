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
  IsUUID,
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

@ApiTags('admin')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'admin')
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
  financeSummary(@Query('period') period?: string) {
    return this.service.getFinancialSummary(period);
  }

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

  @Get('finance/transactions/:id')
  financeTransactionDetail(@Param('id') id: string) {
    return this.service.getFinancialTransactionDetail(id);
  }

  @Get('finance/settings/commission')
  getCommission() {
    return this.service.getCommissionSetting();
  }

  @Put('finance/settings/commission')
  setCommission(@Body() dto: CommissionDto, @CurrentUser('id') actorId?: string) {
    return this.service.updateCommissionSetting(dto.rate, actorId);
  }

  @Get('finance/failed-alert')
  failedAlert() {
    return this.service.getFailedTransactionsAlert();
  }

  @Post('finance/settings/commission')
  setCommissionPost(@Body() dto: CommissionDto, @CurrentUser('id') actorId?: string) {
    return this.service.updateCommissionSetting(dto.rate, actorId);
  }

  @Post('finance/failed-alert/threshold')
  setFailedThreshold(@Body() body: { threshold?: number }, @CurrentUser('id') actorId?: string) {
    return this.service.setFailedTransactionsThreshold(Number(body?.threshold ?? 0), actorId);
  }



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

  @Get('customers/stats')
  customersStats() {
    return this.service.getCustomersStats();
  }

  @Get('users/:id')
  userDetail(@Param('id') id: string) {
    return this.service.getUserDetail(id);
  }

  @Patch('users/:id/status')
  setUserStatus(@Param('id') id: string, @Body() dto: UserStatusDto, @CurrentUser('id') actorId?: string) {
    return this.service.setUserStatus(id, dto.status, actorId, dto.reason);
  }

  @Patch('users/:id/roles')
  setUserRoles(@Param('id') id: string, @Body() dto: RolesDto, @CurrentUser('id') actorId?: string) {
    return this.service.setUserRoles(id, dto.roles, actorId);
  }

  @Delete('users/:id')
  hardDeleteUser(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.service.hardDeleteUser(id, actorId);
  }

  @Post('users/bulk-delete')
  bulkHardDeleteUsers(@Body() dto: BulkDeleteUsersDto, @CurrentUser('id') actorId?: string) {
    return this.service.bulkHardDeleteUsers(dto.userIds, actorId);
  }

  @Delete('professionals/:id')
  hardDeleteProfessional(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.service.hardDeleteProfessional(id, actorId);
  }



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

  @Get('professionals/:id')
  professionalDetail(@Param('id') id: string) {
    return this.service.getProfessionalDetail(id);
  }

  @Patch('professionals/:id/status')
  setProfessionalStatus(@Param('id') id: string, @Body() dto: StatusDto, @CurrentUser('id') actorId?: string) {
    return this.service.setProfessionalStatus(id, dto.status, actorId, dto.reason);
  }

  @Patch('professionals/:id/featured')
  setFeatured(@Param('id') id: string, @Body() dto: FeaturedDto, @CurrentUser('id') actorId?: string) {
    return this.service.setProfessionalFeatured(id, dto.isFeatured, actorId);
  }

  @Get('bookings-stats')
  bookingsStats() {
    return this.service.getBookingsStats();
  }

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

  @Get('bookings/:id')
  bookingDetail(@Param('id') id: string) {
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
  ) {
    return this.service.listReviews({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
    });
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

  @Get('media-stats')
  @ApiOperation({ summary: 'Media KPI cards' })
  mediaStats() {
    return this.service.getMediaStats();
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
}
