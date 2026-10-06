import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ProfessionalsService } from './professionals.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('professionals')
@Controller()
export class ProfessionalsController {
  constructor(private readonly service: ProfessionalsService) {}

  @Public()
  @Get('professionals')
  list(
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('minRating') minRating?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('minDuration') minDuration?: string,
    @Query('sort') sort?: string,
    @Query('availableDate') availableDate?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('verifiedOnly') verifiedOnly?: string,
    @Query('gender') gender?: string,
  ) {
    return this.service.search({
      q,
      city,
      category,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      minRating: minRating != null && minRating !== '' ? parseFloat(minRating) : undefined,
      minPrice: minPrice != null && minPrice !== '' ? parseInt(minPrice, 10) : undefined,
      maxPrice: maxPrice != null && maxPrice !== '' ? parseInt(maxPrice, 10) : undefined,
      minDuration: minDuration != null && minDuration !== '' ? parseInt(minDuration, 10) : undefined,
      sort,
      availableDate,
      lat,
      lng,
      radiusKm,
      verifiedOnly:
        verifiedOnly === '1' ||
        verifiedOnly === 'true' ||
        verifiedOnly === 'yes',
      gender,
    });
  }

  @Public()
  @Get('professionals/:slug')
  one(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @Get('professionals/me')
  me(@CurrentUser('id') userId: string) {
    return this.service.getOwn(userId);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @Patch('professionals/me')
  updateMe(@CurrentUser('id') userId: string, @Body() body: Record<string, unknown>) {
    return this.service.updateOwn(userId, body);
  }
}
