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
import { CurrentUser } from '../common/decorators/current-user.decorator';
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


class CreateTemplateDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() payload?: unknown;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class ApplyTemplateDto {
  @IsString() templateId!: string;
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

  private async audit(
    actorId: string | undefined,
    action: string,
    entityType: string,
    entityId: string | null,
    before: unknown,
    after: unknown,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action,
          entityType,
          entityId,
          before: before as object,
          after: after as object,
        },
      });
    } catch {
      /* non-blocking */
    }
  }


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
  async updatePricingFlags(
    @Param('id') id: string,
    @Body() dto: UpdatePricingFlagsDto,
    @CurrentUser('id') actorId?: string,
  ) {
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
    const updated = await this.prisma.service.update({
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
  async createAttributeGroup(@Param('id') id: string, @Body() dto: UpsertAttributeGroupDto, @CurrentUser('id') actorId?: string) {
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
  async deleteAttributeGroup(@Param('groupId') groupId: string, @CurrentUser('id') actorId?: string) {
    const group = await this.prisma.serviceAttributeGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('attribute group not found');
    this.cache.invalidateCatalog();
    await this.prisma.serviceAttributeGroup.update({
      where: { id: groupId },
      data: { isActive: false },
    });
    await this.audit(actorId, 'catalog.attribute_group.deactivate', 'service_attribute_group', groupId, { isActive: true }, { isActive: false });
    return { id: groupId, deleted: true, hard: false };
  }

  @Post('attribute-groups/:groupId/options')
  @ApiOperation({ summary: 'Create option under attribute group (#80)' })
  async createAttributeOption(@Param('groupId') groupId: string, @Body() dto: UpsertAttributeOptionDto, @CurrentUser('id') actorId?: string) {
    const group = await this.prisma.serviceAttributeGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('attribute group not found');
    const label = dto.label.trim();
    if (!label) throw new BadRequestException('label required');
    this.cache.invalidateCatalog();
    const created = await this.prisma.serviceAttributeOption.create({
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
    await this.audit(actorId, 'catalog.attribute_option.create', 'service_attribute_option', created.id, null, created);
    return created;
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
  async deleteAttributeOption(@Param('optionId') optionId: string, @CurrentUser('id') actorId?: string) {
    const opt = await this.prisma.serviceAttributeOption.findUnique({ where: { id: optionId } });
    if (!opt) throw new NotFoundException('attribute option not found');
    this.cache.invalidateCatalog();
    await this.prisma.serviceAttributeOption.update({
      where: { id: optionId },
      data: { isActive: false },
    });
    await this.audit(actorId, 'catalog.attribute_option.deactivate', 'service_attribute_option', optionId, { isActive: true }, { isActive: false });
    return { id: optionId, deleted: true, hard: false };
  }

  @Get('attribute-templates')
  @ApiOperation({ summary: 'List attribute templates (#80.2)' })
  async listTemplates() {
    return this.prisma.serviceAttributeTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  @Post('attribute-templates')
  @ApiOperation({ summary: 'Create attribute template (#80.2)' })
  async createTemplate(@Body() dto: CreateTemplateDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('name required');
    const payload = Array.isArray(dto.payload) ? dto.payload : [];
    return this.prisma.serviceAttributeTemplate.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        categoryId: dto.categoryId || null,
        payload: payload as object,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  @Post('catalog-services/:id/apply-template')
  @ApiOperation({ summary: 'Copy template groups/options onto catalog service (#80.2)' })
  async applyTemplate(@Param('id') serviceId: string, @Body() dto: ApplyTemplateDto, @CurrentUser('id') actorId?: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('service not found');
    const tpl = await this.prisma.serviceAttributeTemplate.findUnique({ where: { id: dto.templateId } });
    if (!tpl || !tpl.isActive) throw new NotFoundException('template not found');

    const groups = (Array.isArray(tpl.payload) ? tpl.payload : []) as Array<{
      name?: string;
      required?: boolean;
      sortOrder?: number;
      options?: Array<{
        label?: string;
        suggestedPriceDelta?: number;
        suggestedDurationDeltaMin?: number;
        forcesDeposit?: boolean;
        sortOrder?: number;
      }>;
    }>;

    this.cache.invalidateCatalog();
    const created = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const gName = (g.name || '').trim();
      if (!gName) continue;
      const group = await this.prisma.serviceAttributeGroup.create({
        data: {
          serviceId,
          name: gName,
          required: g.required !== false,
          sortOrder: g.sortOrder ?? i,
          isActive: true,
          options: {
            create: (g.options || [])
              .filter((o) => (o.label || '').trim())
              .map((o, j) => ({
                label: (o.label || '').trim(),
                suggestedPriceDelta: o.suggestedPriceDelta ?? 0,
                suggestedDurationDeltaMin: o.suggestedDurationDeltaMin ?? 0,
                forcesDeposit: o.forcesDeposit ?? false,
                sortOrder: o.sortOrder ?? j,
                isActive: true,
              })),
          },
        },
        include: { options: true },
      });
      created.push(group);
    }
    const result = { serviceId, templateId: tpl.id, groupsCreated: created.length, groups: created };
    await this.audit(actorId, 'catalog.template.apply', 'service', serviceId, null, { templateId: tpl.id, groupsCreated: created.length });
    return result;
  }

  @Post('catalog-services/:id/save-as-template')
  @ApiOperation({ summary: 'Save current service attribute structure as template (#80.2)' })
  async saveAsTemplate(@Param('id') serviceId: string, @Body() dto: CreateTemplateDto) {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        attributeGroups: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            options: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    if (!service) throw new NotFoundException('service not found');
    const name = (dto.name || `${service.name} — قالب`).trim();
    const payload = service.attributeGroups.map((g) => ({
      name: g.name,
      required: g.required,
      sortOrder: g.sortOrder,
      options: g.options.map((o) => ({
        label: o.label,
        suggestedPriceDelta: o.suggestedPriceDelta,
        suggestedDurationDeltaMin: o.suggestedDurationDeltaMin,
        forcesDeposit: o.forcesDeposit,
        sortOrder: o.sortOrder,
      })),
    }));
    return this.prisma.serviceAttributeTemplate.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        categoryId: service.categoryId || null,
        payload,
        sortOrder: dto.sortOrder ?? 0,
        isActive: true,
      },
    });
  }

}
