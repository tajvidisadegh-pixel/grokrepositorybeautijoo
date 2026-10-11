import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsArray } from 'class-validator';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProfessionalStatus } from '@prisma/client';

class UpdateProfessionalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  selectedCategoryIds?: string[];
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminProfessionalsExtraController {
  constructor(private readonly service: AdminService) {}

  @Get('professionals-queue')
  queue() {
    return this.service.getProfessionalsReviewQueue();
  }

  @Get('professionals/manage')
  listManage(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: ProfessionalStatus,
    @Query('isFeatured') isFeatured?: string,
    @Query('city') city?: string,
    @Query('specialty') specialty?: string,
    @Query('categoryId') categoryId?: string,
    @Query('minRating') minRating?: string,
    @Query('registeredFrom') registeredFrom?: string,
    @Query('registeredTo') registeredTo?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'ratingAvg' | 'ratingCount' | 'bookings',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.service.listProfessionals({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
      isFeatured: isFeatured !== undefined ? isFeatured === 'true' : undefined,
      city,
      specialty,
      categoryId,
      minRating: minRating ? parseFloat(minRating) : undefined,
      registeredFrom,
      registeredTo,
      sortBy,
      sortOrder,
    });
  }

  @Patch('professionals/:id/profile')
  updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateProfessionalDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.service.updateProfessional(id, dto, actorId);
  }
}
