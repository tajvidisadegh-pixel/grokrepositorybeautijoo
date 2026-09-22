import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MinLength, MaxLength, IsArray, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProfessionalsService } from './professionals.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateProDto {
  @IsString() @MinLength(3) slug!: string;
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() bio?: string;
}

class UpdateProDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) bio?: string;
  @IsOptional() @IsString() @MaxLength(512) coverImageUrl?: string;
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsOptional() @IsString() @MaxLength(512) avatarUrl?: string;
  @IsOptional() @IsString() @MaxLength(5000) profileBio?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) selectedCategoryIds?: string[];
}

class PayoutRequestDto {
  @Type(() => Number) @IsInt() @Min(10000) amount!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

@ApiTags('professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly service: ProfessionalsService) {}

  /** Public list/search — stricter throttle against scraping (#17) */
  @Public()
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Get()
  search(
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
    return this.service.search({
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

  @ApiBearerAuth()
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.service.getOwn(userId);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @Get('me/completion')
  async getCompletion(@CurrentUser('id') userId: string) {
    const own = await this.service.getOwn(userId);
    return own.completion;
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @Get('me/preview')
  getPreview(@CurrentUser('id') userId: string) {
    return this.service.getOwnPreview(userId);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @Get('me/earnings')
  getEarnings(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getEarnings(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @Post('me/payout-request')
  requestPayout(@CurrentUser('id') userId: string, @Body() dto: PayoutRequestDto) {
    return this.service.requestPayout(userId, dto.amount, dto.note);
  }

  /** Public profile by slug — stricter throttle (#17) */
  @Public()
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @ApiBearerAuth()
  @Roles('customer', 'professional', 'admin', 'SUPER_ADMIN')
  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateProDto) {
    return this.service.createForUser(userId, dto);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @Patch('me')
  updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateProDto) {
    return this.service.updateOwn(userId, dto);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @Post('me/publish')
  publish(@CurrentUser('id') userId: string) {
    return this.service.publish(userId);
  }

  @ApiBearerAuth()
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @Post('me/unpublish')
  unpublish(@CurrentUser('id') userId: string) {
    return this.service.unpublish(userId);
  }
}
