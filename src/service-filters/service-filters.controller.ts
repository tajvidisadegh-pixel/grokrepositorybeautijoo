import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ServiceFiltersService } from './service-filters.service';

class CategoryDto { @IsString() @MinLength(1) name!: string; @IsOptional() @IsUUID() parentId?: string | null; @IsOptional() @IsString() slug?: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsString() icon?: string; @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number; @IsOptional() @IsBoolean() isActive?: boolean; }
class AssignCategoryDto { @IsUUID() categoryId!: string; @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number; }
class ProCategoryDto { @IsUUID() categoryId!: string; }
class ReviewDto { @IsString() status!: 'approved' | 'rejected' | 'pending'; }

@ApiTags('service-filters')
@Controller()
export class ServiceFiltersController {
  constructor(private readonly service: ServiceFiltersService, private readonly prisma: PrismaService) {}

  @Public()
  @Get('service-filters/categories')
  publicFilterCategories() {
    return this.prisma.$queryRaw<Array<{ id: string; name: string; slug: string; parentId: string | null; sortOrder: number }>>(Prisma.sql`
      SELECT DISTINCT c.id, c.name, c.slug, c.parent_id AS "parentId", c.sort_order AS "sortOrder"
      FROM service_category_services scs
      JOIN service_categories c ON c.id = scs.category_id AND c.is_active = true
      WHERE scs.is_active = true
        AND EXISTS (
          SELECT 1 FROM professional_service_categories psc
          JOIN professional_services ps ON ps.id = psc.professional_service_id AND ps.is_active = true
          JOIN professionals p ON p.id = ps.professional_id
          WHERE psc.category_id = c.id AND psc.status = 'approved'
            AND p.status = 'approved' AND p.published_at IS NOT NULL
        )
      ORDER BY c.sort_order ASC, c.name ASC
    `);
  }

  @Public()
  @Get('services/:serviceId/filter-categories')
  publicCategories(@Param('serviceId') serviceId: string) { return this.service.listAllowedCategories(serviceId); }

  @Public()
  @Get('service-filters/professionals')
  searchProfessionals(
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('minRating') minRating?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('sort') sort?: string,
    @Query('availableDate') availableDate?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    return this.service.searchProfessionalsByFilter({
      q,
      city,
      category,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      minRating: minRating != null && minRating !== '' ? parseFloat(minRating) : undefined,
      minPrice: minPrice != null && minPrice !== '' ? parseInt(minPrice, 10) : undefined,
      maxPrice: maxPrice != null && maxPrice !== '' ? parseInt(maxPrice, 10) : undefined,
      sort,
      availableDate,
      lat,
      lng,
      radiusKm,
    });
  }

  @ApiBearerAuth() @Roles('professional', 'admin')
  @Get('professionals/me/services/:psId/filter-categories')
  myCategories(@CurrentUser('id') userId: string, @Param('psId') psId: string) { return this.service.listMyCategories(userId, psId); }

  @ApiBearerAuth() @Roles('professional', 'admin')
  @Post('professionals/me/services/:psId/filter-categories')
  requestCategory(@CurrentUser('id') userId: string, @Param('psId') psId: string, @Body() dto: ProCategoryDto) { return this.service.requestCategory(userId, psId, dto.categoryId); }

  @ApiBearerAuth() @Roles('professional', 'admin')
  @Delete('professionals/me/services/:psId/filter-categories/:categoryId')
  removeMyCategory(@CurrentUser('id') userId: string, @Param('psId') psId: string, @Param('categoryId') categoryId: string) { return this.service.removeMyCategory(userId, psId, categoryId); }

  @ApiBearerAuth() @Roles('SUPER_ADMIN')
  @Get('admin/service-categories')
  adminCategories() { return this.service.listAdminCategories(); }

  @ApiBearerAuth() @Roles('SUPER_ADMIN')
  @Post('admin/service-categories')
  createCategory(@Body() dto: CategoryDto) { return this.service.createCategory(dto); }

  @ApiBearerAuth() @Roles('SUPER_ADMIN')
  @Patch('admin/service-categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: CategoryDto) { return this.service.updateCategory(id, dto); }

  @ApiBearerAuth() @Roles('SUPER_ADMIN')
  @Post('admin/services/:serviceId/filter-categories')
  assignCategory(@Param('serviceId') serviceId: string, @Body() dto: AssignCategoryDto) { return this.service.assignCategoryToService(serviceId, dto.categoryId, dto.sortOrder); }

  @ApiBearerAuth() @Roles('SUPER_ADMIN')
  @Delete('admin/services/:serviceId/filter-categories/:categoryId')
  unassignCategory(@Param('serviceId') serviceId: string, @Param('categoryId') categoryId: string) { return this.service.unassignCategoryFromService(serviceId, categoryId); }

  @ApiBearerAuth() @Roles('SUPER_ADMIN')
  @Get('admin/service-category-requests')
  requests(@Query('status') status?: 'pending' | 'approved' | 'rejected') { return this.service.listRequests(status); }

  @ApiBearerAuth() @Roles('SUPER_ADMIN')
  @Patch('admin/service-category-requests/:psId/:categoryId')
  review(@CurrentUser('id') userId: string, @Param('psId') psId: string, @Param('categoryId') categoryId: string, @Body() dto: ReviewDto) { return this.service.reviewRequest(userId, psId, categoryId, dto.status); }
}
