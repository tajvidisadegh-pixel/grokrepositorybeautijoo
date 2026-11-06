import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { LocationsService } from './locations.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class AddLocationDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsString() @MinLength(2) city!: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  /** exact = pin on map, approximate = city/area only (no public pin) */
  @IsOptional() @IsIn(['exact', 'approximate']) precision?: 'exact' | 'approximate';
}

class WorkingHourDto {
  @IsString() dayOfWeek!: string;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() breaks?: { startTime: string; endTime: string }[];
}

class TimeOffDto {
  @IsString() startAt!: string;
  @IsString() endAt!: string;
  @IsOptional() @IsString() reason?: string;
}

@ApiTags('locations-hours')
@ApiBearerAuth()
@Roles('professional', 'admin')
@Controller('professionals/me')
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @Get('locations')
  listLocations(@CurrentUser('id') userId: string) {
    return this.service.listMine(userId);
  }

  @Post('locations')
  addLocation(@CurrentUser('id') userId: string, @Body() dto: AddLocationDto) {
    return this.service.createLocation(userId, dto);
  }

  @Patch('locations/:id')
  updateLocation(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: AddLocationDto,
  ) {
    return this.service.updateLocation(userId, id, dto);
  }

  @Delete('locations/:id')
  deleteLocation(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.deleteLocation(userId, id);
  }

  @Get('working-hours')
  listHours(@CurrentUser('id') userId: string) {
    return this.service.listWorkingHours(userId);
  }

  @Post('working-hours')
  setHours(@CurrentUser('id') userId: string, @Body() dto: WorkingHourDto) {
    return this.service.setWorkingHours(userId, dto);
  }

  @Get('time-off')
  listTimeOff(@CurrentUser('id') userId: string) {
    return this.service.listTimeOff(userId);
  }

  @Post('time-off')
  timeOff(@CurrentUser('id') userId: string, @Body() dto: TimeOffDto) {
    return this.service.addTimeOff(userId, dto);
  }

  @Delete('time-off/:id')
  removeTimeOff(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.removeTimeOff(userId, id);
  }
}
