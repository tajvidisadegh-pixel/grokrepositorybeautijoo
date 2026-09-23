import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  BadRequestException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';

function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `node-${Date.now()}`;
}

class CreateCategoryDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
}

class UpdateCategoryDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() description?: string;
  /** Accepted so frontend sortOrder patch is not rejected by forbidNonWhitelisted (#26). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

class CreateCatalogServiceDto {
  @IsString() @MinLength(1) name!: string;
  @IsUUID() categoryId!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
}

class UpdateCatalogServiceDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() description?: string;
}

@ApiTags('admin-catalog')
@ApiBearerAuth()
@Roles('SUPER_ADMIN', 'admin')
@Controller('admin')
export class AdminCatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('service-categories')
  @ApiOperation({ summary: 'List all service categories (including inactive)' })
  listCategories() {
    return this.prisma.serviceCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { services: true, children: true } },
      },
    });
  }

  @Post('service-categories')
  async createCategory(@Body() dto: CreateCategoryDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('name required');
    if (dto.parentId) {
      const parent = await this.prisma.serviceCategory.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('parent not found');
    }
    let slug = (dto.slug?.trim() || slugify(name)).slice(0, 140);
    const existing = await this.prisma.serviceCategory.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`.slice(0, 140);
    return this.prisma.serviceCategory.create({
      data: {
        name,
        slug,
        parentId: dto.parentId || null,
        description: dto.description?.trim() || null,
        isActive: true,
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { services: true, children: true } },
      },
    });
  }

  @Patch('service-categories/:id')
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    const row = await this.prisma.serviceCategory.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('category not found');
    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) throw new BadRequestException('invalid parent');
      const parent = await this.prisma.serviceCategory.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('parent not found');
    }
    return this.prisma.serviceCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { services: true, children: true } },
      },
    });
  }

  /** Soft-delete: deactivate category (and optionally leave children/services). Matches UI «غیرفعال». Issue #26. */
  @Delete('service-categories/:id')
  @ApiOperation({ summary: 'Soft-delete category (isActive=false) — seed will not reactivate' })
  async deleteCategory(@Param('id') id: string) {
    const row = await this.prisma.serviceCategory.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('category not found');
    const updated = await this.prisma.serviceCategory.update({
      where: { id },
      data: { isActive: false },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { services: true, children: true } },
      },
    });
    return { id, deleted: true, hard: false, isActive: updated.isActive };
  }

  @Get('catalog-services')
  listCatalogServices() {
    return this.prisma.service.findMany({
      orderBy: { name: 'asc' },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  @Post('catalog-services')
  async createCatalogService(@Body() dto: CreateCatalogServiceDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('name required');
    const category = await this.prisma.serviceCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('category not found');
    let slug = (dto.slug?.trim() || slugify(name)).slice(0, 160);
    const existing = await this.prisma.service.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`.slice(0, 160);
    return this.prisma.service.create({
      data: {
        name,
        slug,
        categoryId: dto.categoryId,
        description: dto.description?.trim() || null,
        isActive: true,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  @Patch('catalog-services/:id')
  async updateCatalogService(@Param('id') id: string, @Body() dto: UpdateCatalogServiceDto) {
    const row = await this.prisma.service.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('service not found');
    if (dto.categoryId) {
      const category = await this.prisma.serviceCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException('category not found');
    }
    return this.prisma.service.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  /** Soft-delete specialty — do not wipe professionalService rows (#26). */
  @Delete('catalog-services/:id')
  @ApiOperation({ summary: 'Soft-delete catalog service (isActive=false)' })
  async deleteCatalogService(@Param('id') id: string) {
    const row = await this.prisma.service.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('service not found');
    const updated = await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    return { id, deleted: true, hard: false, isActive: updated.isActive };
  }
}
