import { Prisma } from '@prisma/client';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';
import { AppCacheService } from '../cache/app-cache.service';

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

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professionals: ProfessionalsService,
    private readonly cache: AppCacheService,
  ) {}

  async listCategories() {
    const cacheKey = 'catalog:categories';
    const hit = this.cache.get<unknown>(cacheKey);
    if (hit) return hit;

    const all = await this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        services: { where: { isActive: true }, orderBy: { name: 'asc' } },
      },
    });

    type CatRow = (typeof all)[number] & { children: CatRow[] };
    const byId = new Map<string, CatRow>();
    for (const c of all) {
      byId.set(c.id, { ...c, children: [] });
    }
    const roots: CatRow[] = [];
    for (const c of byId.values()) {
      if (c.parentId && byId.has(c.parentId)) {
        byId.get(c.parentId)!.children.push(c);
      } else {
        roots.push(c);
      }
    }
    const sortTree = (nodes: CatRow[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      for (const n of nodes) sortTree(n.children);
    };
    sortTree(roots);
    this.cache.set(cacheKey, roots, 120_000);
    return roots;
  }

  async listHierarchy() {
    return this.listCategories();
  }

  listServices(categorySlug?: string) {
    return this.prisma.service.findMany({
      where: {
        isActive: true,
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async createCategoryNode(
    userId: string,
    data: {
      name: string;
      parentId?: string | null;
      slug?: string;
      description?: string;
      icon?: string;
      sortOrder?: number;
    },
  ) {
    await this.professionals.requireOwnProfessional(userId);
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('نام دسته الزامی است');

    if (data.parentId) {
      const parent = await this.prisma.serviceCategory.findFirst({
        where: { id: data.parentId, isActive: true },
      });
      if (!parent) throw new NotFoundException('دسته والد یافت نشد');
    }

    let slug = (data.slug?.trim() || slugify(name)).slice(0, 120);
    const existing = await this.prisma.serviceCategory.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`.slice(0, 120);
    }

    return this.prisma.serviceCategory.create({
      data: {
        name,
        slug,
        description: data.description?.trim() || null,
        icon: data.icon?.trim() || null,
        sortOrder: data.sortOrder ?? 0,
        parentId: data.parentId ?? null,
        isActive: true,
      },
    });
  }

  async createServiceNode(
    userId: string,
    data: {
      name: string;
      categoryId: string;
      slug?: string;
      description?: string;
    },
  ) {
    await this.professionals.requireOwnProfessional(userId);
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('نام خدمت الزامی است');

    const category = await this.prisma.serviceCategory.findFirst({
      where: { id: data.categoryId, isActive: true },
    });
    if (!category) throw new NotFoundException('دسته یافت نشد');

    let slug = (data.slug?.trim() || slugify(name)).slice(0, 160);
    const existing = await this.prisma.service.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`.slice(0, 160);
    }

    return this.prisma.service.create({
      data: {
        name,
        slug,
        categoryId: data.categoryId,
        description: data.description?.trim() || null,
        isActive: true,
      },
      include: { category: true },
    });
  }

  async upsertProfessionalService(
    userId: string,
    data: {
      serviceId: string;
      durationMin: number;
      price: number;
      bufferMin?: number;
      description?: string;
      isActive?: boolean;
    },
  ) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const service = await this.prisma.service.findUnique({
      where: { id: data.serviceId },
    });
    if (!service) throw new NotFoundException('خدمت یافت نشد');
    if (!service.isActive) throw new BadRequestException('این خدمت غیرفعال است');

    if (data.durationMin == null || data.durationMin < 5) {
      throw new BadRequestException('مدت باید حداقل ۵ دقیقه باشد');
    }
    if (data.price == null || data.price < 0) {
      throw new BadRequestException('قیمت نامعتبر است');
    }

    return this.prisma.professionalService.upsert({
      where: {
        professionalId_serviceId: {
          professionalId: pro.id,
          serviceId: data.serviceId,
        },
      },
      update: {
        durationMin: data.durationMin,
        price: data.price,
        bufferMin: data.bufferMin ?? 0,
        description: data.description,
        isActive: data.isActive ?? true,
      },
      create: {
        professionalId: pro.id,
        serviceId: data.serviceId,
        durationMin: data.durationMin,
        price: data.price,
        bufferMin: data.bufferMin ?? 0,
        description: data.description,
        isActive: data.isActive ?? true,
      },
      include: {
        service: { include: { category: true } },
        priceRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        durationRules: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        addOns: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        mediaAssets: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async updateProfessionalService(
    userId: string,
    id: string,
    data: {
      durationMin?: number;
      price?: number;
      bufferMin?: number;
      description?: string;
      isActive?: boolean;
    },
  ) {
    await this.requireOwnPs(userId, id);
    if (data.durationMin != null && data.durationMin < 5) {
      throw new BadRequestException('مدت باید حداقل ۵ دقیقه باشد');
    }
    if (data.price != null && data.price < 0) {
      throw new BadRequestException('قیمت نامعتبر است');
    }
    return this.prisma.professionalService.update({
      where: { id },
      data: {
        ...(data.durationMin != null ? { durationMin: data.durationMin } : {}),
        ...(data.price != null ? { price: data.price } : {}),
        ...(data.bufferMin != null ? { bufferMin: data.bufferMin } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: {
        service: { include: { category: true } },
        addOns: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        mediaAssets: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async listMyServices(userId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    return this.prisma.professionalService.findMany({
      where: { professionalId: pro.id },
      include: {
        service: { include: { category: true } },
        priceRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        durationRules: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        addOns: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        mediaAssets: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Rename catalog Service linked to this offer — only if this pro is the sole offerer.
   * Category hierarchy unchanged; booking snapshots remain historical.
   */
  async renameMyService(userId: string, professionalServiceId: string, name: string) {
    const { pro, ps } = await this.requireOwnPs(userId, professionalServiceId);
    const trimmed = name?.trim();
    if (!trimmed) throw new BadRequestException('نام تخصص الزامی است');

    const others = await this.prisma.professionalService.count({
      where: { serviceId: ps.serviceId, professionalId: { not: pro.id } },
    });
    if (others > 0) {
      throw new BadRequestException(
        'این تخصص در کاتالوگ مشترک است و نام آن از اینجا قابل تغییر نیست',
      );
    }

    await this.prisma.service.update({
      where: { id: ps.serviceId },
      data: { name: trimmed.slice(0, 150) },
    });

    return this.prisma.professionalService.findUnique({
      where: { id: professionalServiceId },
      include: {
        service: { include: { category: true } },
        priceRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        durationRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        addOns: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        mediaAssets: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async deactivateMyService(userId: string, id: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const ps = await this.prisma.professionalService.findFirst({
      where: { id, professionalId: pro.id },
    });
    if (!ps) throw new NotFoundException();
    // Hard delete: cascade removes addOns, priceRules, durationRules; media SetNull
    await this.prisma.professionalService.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Alias kept for callers that expect delete semantics */
  async deleteMyService(userId: string, id: string) {
    return this.deactivateMyService(userId, id);
  }

  private async requireOwnPs(userId: string, professionalServiceId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const ps = await this.prisma.professionalService.findFirst({
      where: { id: professionalServiceId, professionalId: pro.id },
    });
    if (!ps) throw new NotFoundException('خدمت زیباگر یافت نشد');
    return { pro, ps };
  }

  async listAddOns(userId: string, professionalServiceId: string) {
    await this.requireOwnPs(userId, professionalServiceId);
    return this.prisma.serviceAddOn.findMany({
      where: { professionalServiceId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async upsertAddOn(
    userId: string,
    professionalServiceId: string,
    data: {
      id?: string;
      name: string;
      description?: string;
      price: number;
      extraDurationMin?: number;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    await this.requireOwnPs(userId, professionalServiceId);
    const name = data.name?.trim();
    if (!name) throw new BadRequestException('نام افزودنی الزامی است');
    if (data.price == null || data.price < 0) {
      throw new BadRequestException('قیمت افزودنی نامعتبر است');
    }
    const extraDurationMin = data.extraDurationMin ?? 0;
    if (extraDurationMin < 0) {
      throw new BadRequestException('مدت اضافه نامعتبر است');
    }

    if (data.id) {
      const existing = await this.prisma.serviceAddOn.findFirst({
        where: { id: data.id, professionalServiceId },
      });
      if (!existing) throw new NotFoundException('افزودنی یافت نشد');
      return this.prisma.serviceAddOn.update({
        where: { id: data.id },
        data: {
          name,
          description: data.description?.trim() ?? existing.description,
          price: data.price,
          extraDurationMin,
          sortOrder: data.sortOrder ?? existing.sortOrder,
          isActive: data.isActive ?? true,
        },
      });
    }

    return this.prisma.serviceAddOn.create({
      data: {
        professionalServiceId,
        name,
        description: data.description?.trim() || null,
        price: data.price,
        extraDurationMin,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  async deactivateAddOn(userId: string, addOnId: string) {
    const addOn = await this.prisma.serviceAddOn.findUnique({ where: { id: addOnId } });
    if (!addOn) throw new NotFoundException();
    await this.requireOwnPs(userId, addOn.professionalServiceId);
    return this.prisma.serviceAddOn.update({
      where: { id: addOnId },
      data: { isActive: false },
    });
  }

  async attachMediaToProfessionalService(
    userId: string,
    professionalServiceId: string,
    mediaId: string,
  ) {
    const { pro } = await this.requireOwnPs(userId, professionalServiceId);
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, professionalId: pro.id },
    });
    if (!media) throw new NotFoundException('رسانه یافت نشد');

    return this.prisma.mediaAsset.update({
      where: { id: mediaId },
      data: {
        professionalServiceId,
        kind: 'service',
      },
    });
  }

  async detachMediaFromProfessionalService(
    userId: string,
    professionalServiceId: string,
    mediaId: string,
  ) {
    await this.requireOwnPs(userId, professionalServiceId);
    const media = await this.prisma.mediaAsset.findFirst({
      where: { id: mediaId, professionalServiceId },
    });
    if (!media) throw new NotFoundException('رسانه یافت نشد');

    return this.prisma.mediaAsset.update({
      where: { id: mediaId },
      data: { professionalServiceId: null },
    });
  }

  async listMediaForProfessionalService(userId: string, professionalServiceId: string) {
    await this.requireOwnPs(userId, professionalServiceId);
    return this.prisma.mediaAsset.findMany({
      where: { professionalServiceId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async listPriceRules(userId: string, professionalServiceId: string) {
    await this.requireOwnPs(userId, professionalServiceId);
    return this.prisma.servicePriceRule.findMany({
      where: { professionalServiceId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async upsertPriceRule(
    userId: string,
    professionalServiceId: string,
    data: {
      id?: string;
      label: string;
      price: number;
      attributes?: Record<string, unknown>;
      sortOrder?: number;
    },
  ) {
    await this.requireOwnPs(userId, professionalServiceId);
    if (!data.label?.trim()) throw new BadRequestException('برچسب الزامی است');
    if (data.price == null || data.price < 0) throw new BadRequestException('قیمت نامعتبر است');

    if (data.id) {
      const existing = await this.prisma.servicePriceRule.findFirst({
        where: { id: data.id, professionalServiceId },
      });
      if (!existing) throw new NotFoundException('قانون قیمت یافت نشد');
      return this.prisma.servicePriceRule.update({
        where: { id: data.id },
        data: {
          label: data.label.trim(),
          price: data.price,
          attributes: (data.attributes as Prisma.InputJsonValue | undefined) ?? undefined,
          sortOrder: data.sortOrder ?? existing.sortOrder,
          isActive: true,
        },
      });
    }

    return this.prisma.servicePriceRule.create({
      data: {
        professionalServiceId,
        label: data.label.trim(),
        price: data.price,
        attributes: (data.attributes as Prisma.InputJsonValue | undefined) ?? undefined,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async deactivatePriceRule(userId: string, ruleId: string) {
    const rule = await this.prisma.servicePriceRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException();
    await this.requireOwnPs(userId, rule.professionalServiceId);
    return this.prisma.servicePriceRule.update({
      where: { id: ruleId },
      data: { isActive: false },
    });
  }

  async listDurationRules(userId: string, professionalServiceId: string) {
    await this.requireOwnPs(userId, professionalServiceId);
    return this.prisma.serviceDurationRule.findMany({
      where: { professionalServiceId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async upsertDurationRule(
    userId: string,
    professionalServiceId: string,
    data: {
      id?: string;
      label: string;
      durationMin: number;
      durationMaxMin?: number;
      attributes?: Record<string, unknown>;
      sortOrder?: number;
    },
  ) {
    await this.requireOwnPs(userId, professionalServiceId);
    if (!data.label?.trim()) throw new BadRequestException('برچسب الزامی است');
    if (!data.durationMin || data.durationMin < 5) {
      throw new BadRequestException('مدت باید حداقل ۵ دقیقه باشد');
    }

    if (data.id) {
      const existing = await this.prisma.serviceDurationRule.findFirst({
        where: { id: data.id, professionalServiceId },
      });
      if (!existing) throw new NotFoundException('قانون مدت یافت نشد');
      return this.prisma.serviceDurationRule.update({
        where: { id: data.id },
        data: {
          label: data.label.trim(),
          durationMin: data.durationMin,
          durationMaxMin: data.durationMaxMin ?? null,
          attributes: (data.attributes as Prisma.InputJsonValue | undefined) ?? undefined,
          sortOrder: data.sortOrder ?? existing.sortOrder,
          isActive: true,
        },
      });
    }

    return this.prisma.serviceDurationRule.create({
      data: {
        professionalServiceId,
        label: data.label.trim(),
        durationMin: data.durationMin,
        durationMaxMin: data.durationMaxMin ?? null,
        attributes: (data.attributes as Prisma.InputJsonValue | undefined) ?? undefined,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async deactivateDurationRule(userId: string, ruleId: string) {
    const rule = await this.prisma.serviceDurationRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException();
    await this.requireOwnPs(userId, rule.professionalServiceId);
    return this.prisma.serviceDurationRule.update({
      where: { id: ruleId },
      data: { isActive: false },
    });
  }
}
