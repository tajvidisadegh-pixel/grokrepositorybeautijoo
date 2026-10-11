import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ServicesService } from './services.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
class UpsertProServiceDto { @IsUUID() serviceId!: string; @Type(() => Number) @IsInt() @Min(5) durationMin!: number; @Type(() => Number) @IsInt() @Min(0) price!: number; @IsOptional() @Type(() => Number) @IsInt() @Min(0) bufferMin?: number; @IsOptional() @IsString() description?: string; @IsOptional() @IsBoolean() isActive?: boolean; }
class PatchProServiceDto { @IsOptional() @Type(() => Number) @IsInt() @Min(5) durationMin?: number; @IsOptional() @Type(() => Number) @IsInt() @Min(0) price?: number; @IsOptional() @Type(() => Number) @IsInt() @Min(0) bufferMin?: number; @IsOptional() @IsString() description?: string; @IsOptional() @IsBoolean() isActive?: boolean; }
class RenameMyServiceDto { @IsString() @MinLength(1) name!: string; }
class CreateCategoryNodeDto { @IsString() @MinLength(1) name!: string; @IsOptional() @IsUUID() parentId?: string; @IsOptional() @IsString() slug?: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsString() icon?: string; @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number; }
class CreateServiceNodeDto { @IsString() @MinLength(1) name!: string; @IsUUID() categoryId!: string; @IsOptional() @IsString() slug?: string; @IsOptional() @IsString() description?: string; }
class UpsertPriceRuleDto { @IsOptional() @IsUUID() id?: string; @IsString() @MinLength(1) label!: string; @Type(() => Number) @IsInt() @Min(0) price!: number; @IsOptional() @IsObject() attributes?: Record<string, unknown>; @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number; }
class UpsertDurationRuleDto { @IsOptional() @IsUUID() id?: string; @IsString() @MinLength(1) label!: string; @Type(() => Number) @IsInt() @Min(5) durationMin!: number; @IsOptional() @Type(() => Number) @IsInt() @Min(5) durationMaxMin?: number; @IsOptional() @IsObject() attributes?: Record<string, unknown>; @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number; }
class UpsertAddOnDto { @IsOptional() @IsUUID() id?: string; @IsString() @MinLength(1) name!: string; @IsOptional() @IsString() description?: string; @Type(() => Number) @IsInt() @Min(0) price!: number; @IsOptional() @Type(() => Number) @IsInt() @Min(0) extraDurationMin?: number; @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number; @IsOptional() @IsBoolean() isActive?: boolean; }
class AttachMediaDto { @IsUUID() mediaId!: string; }
@ApiTags('services')
@Controller()
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  @Get('catalog-addons')
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @ApiBearerAuth()
  listCatalogAddOns() {
    return this.service.listCatalogAddOns();
  }

  @Public() @Get('categories') categories() { return this.service.listCategories(); }
  @Public() @Get('services/hierarchy') hierarchy() { return this.service.listHierarchy(); }
  @Public() @Get('services') services(@Query('category') category?: string) { return this.service.listServices(category); }
  @ApiBearerAuth() @Roles('SUPER_ADMIN') @Post('categories') createCategory(@CurrentUser('id') userId: string, @Body() dto: CreateCategoryNodeDto) { return this.service.createCategoryNode(userId, dto); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Post('services') createService(@CurrentUser('id') userId: string, @Body() dto: CreateServiceNodeDto) { return this.service.createServiceNode(userId, dto); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Get('professionals/me/services') myServices(@CurrentUser('id') userId: string) { return this.service.listMyServices(userId); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Post('professionals/me/services') upsert(@CurrentUser('id') userId: string, @Body() dto: UpsertProServiceDto) { return this.service.upsertProfessionalService(userId, dto); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Patch('professionals/me/services/:id') patchProService(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: PatchProServiceDto) { return this.service.updateProfessionalService(userId, id, dto); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Patch('professionals/me/services/:id/name') renameMyService(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: RenameMyServiceDto) { return this.service.renameMyService(userId, id, dto.name); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Delete('professionals/me/services/:id') deleteMyService(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.deactivateMyService(userId, id); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Get('professionals/me/services/:psId/add-ons') listAddOns(@CurrentUser('id') userId: string, @Param('psId') psId: string) { return this.service.listAddOns(userId, psId); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Post('professionals/me/services/:psId/add-ons') upsertAddOn(@CurrentUser('id') userId: string, @Param('psId') psId: string, @Body() dto: UpsertAddOnDto) { return this.service.upsertAddOn(userId, psId, dto); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Delete('professionals/me/add-ons/:id') deactivateAddOn(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.deactivateAddOn(userId, id); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Get('professionals/me/services/:psId/media') listMedia(@CurrentUser('id') userId: string, @Param('psId') psId: string) { return this.service.listMediaForProfessionalService(userId, psId); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Post('professionals/me/services/:psId/media') attachMedia(@CurrentUser('id') userId: string, @Param('psId') psId: string, @Body() dto: AttachMediaDto) { return this.service.attachMediaToProfessionalService(userId, psId, dto.mediaId); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Delete('professionals/me/services/:psId/media/:mediaId') detachMedia(@CurrentUser('id') userId: string, @Param('psId') psId: string, @Param('mediaId') mediaId: string) { return this.service.detachMediaFromProfessionalService(userId, psId, mediaId); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Get('professionals/me/services/:psId/price-rules') listPriceRules(@CurrentUser('id') userId: string, @Param('psId') psId: string) { return this.service.listPriceRules(userId, psId); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Post('professionals/me/services/:psId/price-rules') upsertPriceRule(@CurrentUser('id') userId: string, @Param('psId') psId: string, @Body() dto: UpsertPriceRuleDto) { return this.service.upsertPriceRule(userId, psId, dto); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Delete('professionals/me/price-rules/:id') deactivatePriceRule(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.deactivatePriceRule(userId, id); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Get('professionals/me/services/:psId/duration-rules') listDurationRules(@CurrentUser('id') userId: string, @Param('psId') psId: string) { return this.service.listDurationRules(userId, psId); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Post('professionals/me/services/:psId/duration-rules') upsertDurationRule(@CurrentUser('id') userId: string, @Param('psId') psId: string, @Body() dto: UpsertDurationRuleDto) { return this.service.upsertDurationRule(userId, psId, dto); }
  @ApiBearerAuth() @Roles('professional', 'admin') @Delete('professionals/me/duration-rules/:id') deactivateDurationRule(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.deactivateDurationRule(userId, id); }
}
