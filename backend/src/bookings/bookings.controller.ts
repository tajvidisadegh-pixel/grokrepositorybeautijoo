import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, ArrayMinSize, MinLength, MaxLength } from 'class-validator';
import { BookingsService } from './bookings.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateBookingDto {
  @IsUUID() professionalId!: string;
  @IsArray() @ArrayMinSize(1) @IsUUID('4', { each: true }) serviceIds!: string[];
  @IsString() startAt!: string;
  @IsOptional() @IsUUID() locationId?: string;
  @IsOptional() @IsString() notes?: string;
  /** Selected ServiceAddOn ids — validated server-side against professional services */
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) addOnIds?: string[];
  /** Optional active ServicePriceRule for the primary service */
  @IsOptional() @IsUUID() priceRuleId?: string;
  /** Optional active ServiceDurationRule for the primary service */
  @IsOptional() @IsUUID() durationRuleId?: string;
}

class TransitionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class ReportDto {
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  message!: string;
}

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Roles('customer', 'admin')
  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateBookingDto) {
    return this.service.create(userId, dto);
  }

  @Roles('customer', 'admin')
  @Get('mine')
  mine(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listMineAsCustomer(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Roles('professional', 'admin')
  @Get('professional')
  asPro(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('serviceId') serviceId?: string,
  ) {
    return this.service.listMineAsProfessional(userId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      q,
      status,
      from,
      to,
      serviceId,
    });
  }

  @Get(':id')
  one(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.getOne(id, userId, roles || []);
  }

  @Patch(':id/confirm')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.transition(id, userId, roles || [], 'confirm');
  }

  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Body() dto: TransitionDto,
  ) {
    return this.service.transition(id, userId, roles || [], 'reject', dto.reason);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Body() dto: TransitionDto,
  ) {
    return this.service.transition(id, userId, roles || [], 'cancel', dto.reason);
  }

  @Patch(':id/complete')
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.service.transition(id, userId, roles || [], 'complete');
  }

  /** Professional (or admin) reports a booking issue to SUPER_ADMIN */
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @Post(':id/report')
  report(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Body() dto: ReportDto,
  ) {
    return this.service.reportToAdmin(id, userId, roles || [], dto.message);
  }
}
