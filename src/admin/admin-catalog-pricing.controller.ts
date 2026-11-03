import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { AppCacheService } from '../cache/app-cache.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import {
  normalizePricingMode,
  type CatalogPricingFlags,
  type PricingMode,
} from '../services/pricing-mode';

class UpdatePricingFlagsDto {
  @IsOptional() @IsBoolean() allowFixed?: boolean;
  @IsOptional() @IsBoolean() allowVariable?: boolean;
  @IsOptional() @IsBoolean() allowDeposit?: boolean;
  @IsOptional() @IsIn(['fixed', 'variable', 'deposit']) defaultPricingMode?: PricingMode;
}

class UpsertAttributeGroupDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpsertAttributeOptionDto {
  @IsString() @MinLength(1) label!: string;
  @IsOptional() @Type(() => Number) @IsInt() suggestedPriceDelta?: number;
  @IsOptional() @Type(() => Number) @IsInt() suggestedDurationDeltaMin?: number;
  @IsOptional() @IsBoolean() forcesDeposit?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

function assertAtLeastOneMode(flags: CatalogPricingFlags) {
  if (!flags.allowFixed && !flags.allowVariable && !flags.allowDeposit) {
    throw new BadRequestException('حداقل یک حالت قیمت‌گذاری باید فعال باشد');
  }
  const mode = normalizePricingMode(flags.defaultPricingMode);
  if (mode === 'fixed' && !flags.allowFixed) {
    throw new BadRequestException('defaultPricingMode=fixed در حالی که allowFixed خاموش است');
  }
  if (mode === 'variable' && !flags.allowVariable) {
    throw new BadRequestException('defaultPricingMode=variable در حالی که allowVariable خاموش است');
  }
  if (mode === 'deposit' && !flags.allowDeposit) {
    throw new BadRequestException('defaultPricingMode=deposit در حالی که allowDeposit خاموش است');
  }
}

@ApiTags('admin-catalog-pricing')
@ApiBearerAuth()
@RequirePermissions('admin.catalog.manage')
@Controller('admin')
export class AdminCatalogPricingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService,
  ) {}

  private serviceInclude() {
    return {
      category: { select: { id: true, name: true, slug: true } },
      attributeGroups: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          options: { orderBy: { sortOrder: 'asc' as const } },
        },
      },
    };
  }

  @Get('catalog-services/:id/pricing')
  @ApiOperation({ summary: 'Get catalog service pricing flags + attribute groups (#80)' })
  async getServicePricing(@Param('id') id: string) {
    const row = await this.prisma.service.findUnique({
      where: { id },
      include: this.serviceInclude(),
    });
    if (!row) throw new NotFoundException('service not found');
    return row;
  }

  @Patch('catalog-services/:id/pricing-flags')
  @ApiOperation({ summary: 'Update allowFixed/allowVariable/allowDeposit/defaultPricingMode (#80)' })
  async updatePricingFlags(@Param('id') id: string, @Body() dto: UpdatePricingFlagsDto) {
    const row = await this.prisma.service.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('service not found');

    const next: CatalogPricingFlags = {
      allowFixed: dto.allowFixed ?? row.allowFixed,
      allowVariable: dto.allowVariable ?? row.allowVariable,
      allowDeposit: dto.allowDeposit ?? row.allowDeposit,
      defaultPricingMode: dto.defaultPricingMode ?? row.defaultPricingMode,
    };
    assertAtLeastOneMode(next);

    this.cache.invalidateCatalog();
    return this.prisma.service.update({
      where: { id },
      data: {
        allowFixed: next.allowFixed,
        allowVariable: next.allowVariable,
        allowDeposit: next.allowDeposit,
        defaultPricingMode: normalizePricingMode(next.defaultPricingMode),
      },
      include: this.serviceInclude(),
    });
  }

  @Get('catalog-services/:id/attribute-groups')
  @ApiOperation({ summary: 'List attribute groups for a catalog service (#80)' })
  async listAttributeGroups(@Param('id') id: string) {
    const row = await this.prisma.service.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException('service not found');
    return this.prisma.serviceAttributeGroup.findMany({
      where: { serviceId: id },
      orderBy: { sortOrder: 'asc' },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  @Post('catalog-services/:id/attribute-groups')
  @ApiOperation({ summary: 'Create attribute group on catalog service (#80)' })
  async createAttributeGroup(@Param('id') id: string, @Body() dto: UpsertAttributeGroupDto) {
    const row = await this.prisma.service.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException('service not found');
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('name required');
    this.cache.invalidateCatalog();
    return this.prisma.serviceAttributeGroup.create({
      data: {
        serviceId: id,
        name,
        required: dto.required ?? true,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: { options: true },
    });
  }

  @Patch('attribute-groups/:groupId')
  @ApiOperation({ summary: 'Update attribute group (#80)' })
  async updateAttributeGroup(@Param('groupId') groupId: string, @Body() dto: UpsertAttributeGroupDto) {
    const group = await this.prisma.serviceAttributeGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('attribute group not found');
    this.cache.invalidateCatalog();
    return this.prisma.serviceAttributeGroup.update({
      where: { id: groupId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.required !== undefined ? { required: dto.required } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  @Delete('attribute-groups/:groupId')
  @ApiOperation({ summary: 'Soft-deactivate attribute group (#80)' })
  async deleteAttributeGroup(@Param('groupId') groupId: string) {
    const group = await this.prisma.serviceAttributeGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('attribute group not found');
    this.cache.invalidateCatalog();
    await this.prisma.serviceAttributeGroup.update({
      where: { id: groupId },
      data: { isActive: false },
    });
    return { id: groupId, deleted: true, hard: false };
  }

  @Post('attribute-groups/:groupId/options')
  @ApiOperation({ summary: 'Create option under attribute group (#80)' })
  async createAttributeOption(@Param('groupId') groupId: string, @Body() dto: UpsertAttributeOptionDto) {
    const group = await this.prisma.serviceAttributeGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('attribute group not found');
    const label = dto.label.trim();
    if (!label) throw new BadRequestException('label required');
    this.cache.invalidateCatalog();
    return this.prisma.serviceAttributeOption.create({
      data: {
        groupId,
        label,
        suggestedPriceDelta: dto.suggestedPriceDelta ?? 0,
        suggestedDurationDeltaMin: dto.suggestedDurationDeltaMin ?? 0,
        forcesDeposit: dto.forcesDeposit ?? false,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  @Patch('attribute-options/:optionId')
  @ApiOperation({ summary: 'Update attribute option (#80)' })
  async updateAttributeOption(@Param('optionId') optionId: string, @Body() dto: UpsertAttributeOptionDto) {
    const opt = await this.prisma.serviceAttributeOption.findUnique({ where: { id: optionId } });
    if (!opt) throw new NotFoundException('attribute option not found');
    this.cache.invalidateCatalog();
    return this.prisma.serviceAttributeOption.update({
      where: { id: optionId },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.suggestedPriceDelta !== undefined ? { suggestedPriceDelta: dto.suggestedPriceDelta } : {}),
        ...(dto.suggestedDurationDeltaMin !== undefined
          ? { suggestedDurationDeltaMin: dto.suggestedDurationDeltaMin }
          : {}),
        ...(dto.forcesDeposit !== undefined ? { forcesDeposit: dto.forcesDeposit } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  @Delete('attribute-options/:optionId')
  @ApiOperation({ summary: 'Soft-deactivate attribute option (#80)' })
  async deleteAttributeOption(@Param('optionId') optionId: string) {
    const opt = await this.prisma.serviceAttributeOption.findUnique({ where: { id: optionId } });
    if (!opt) throw new NotFoundException('attribute option not found');
    this.cache.invalidateCatalog();
    await this.prisma.serviceAttributeOption.update({
      where: { id: optionId },
      data: { isActive: false },
    });
    return { id: optionId, deleted: true, hard: false };
  }
}
