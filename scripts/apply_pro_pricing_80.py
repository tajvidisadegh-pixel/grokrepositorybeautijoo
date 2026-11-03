#!/usr/bin/env python3
"""Apply #80.3 pro pricing fields to services.controller.ts and services.service.ts"""
from pathlib import Path

def patch_controller() -> None:
    path = Path("backend/src/services/services.controller.ts")
    t = path.read_text()
    if "depositAmount?" in t and "optionDeltas?" in t and "UpsertProServiceDto" in t:
        print("controller already patched")
        return
    t = t.replace(
        "import { IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';",
        "import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';",
    )
    old_up = "class UpsertProServiceDto { @IsUUID() serviceId!: string; @Type(() => Number) @IsInt() @Min(5) durationMin!: number; @Type(() => Number) @IsInt() @Min(0) price!: number; @IsOptional() @Type(() => Number) @IsInt() @Min(0) bufferMin?: number; @IsOptional() @IsString() description?: string; @IsOptional() @IsBoolean() isActive?: boolean; }"
    new_up = """class UpsertProServiceDto {
  @IsUUID() serviceId!: string;
  @Type(() => Number) @IsInt() @Min(5) durationMin!: number;
  @Type(() => Number) @IsInt() @Min(0) price!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bufferMin?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsIn(['fixed', 'variable', 'deposit']) pricingMode?: 'fixed' | 'variable' | 'deposit';
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) depositAmount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) estimateMinPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) estimateMaxPrice?: number;
  @IsOptional() @IsObject() optionDeltas?: Record<string, unknown>;
}"""
    if old_up not in t:
        raise SystemExit("UpsertProServiceDto anchor missing")
    t = t.replace(old_up, new_up, 1)
    old_patch = "class PatchProServiceDto { @IsOptional() @Type(() => Number) @IsInt() @Min(5) durationMin?: number; @IsOptional() @Type(() => Number) @IsInt() @Min(0) price?: number; @IsOptional() @Type(() => Number) @IsInt() @Min(0) bufferMin?: number; @IsOptional() @IsString() description?: string; @IsOptional() @IsBoolean() isActive?: boolean; }"
    new_patch = """class PatchProServiceDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) durationMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) price?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bufferMin?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsIn(['fixed', 'variable', 'deposit']) pricingMode?: 'fixed' | 'variable' | 'deposit';
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) depositAmount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) estimateMinPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) estimateMaxPrice?: number;
  @IsOptional() @IsObject() optionDeltas?: Record<string, unknown>;
}"""
    if old_patch not in t:
        raise SystemExit("PatchProServiceDto anchor missing")
    t = t.replace(old_patch, new_patch, 1)
    path.write_text(t)
    print("controller patched", path.stat().st_size)


def patch_service() -> None:
    path = Path("backend/src/services/services.service.ts")
    t = path.read_text()
    if "resolvePricingFields" in t:
        print("service already patched")
        return

    if "from './pricing-mode'" not in t:
        t = t.replace(
            "from '../professionals/professionals.service';",
            "from '../professionals/professionals.service';\nimport {\n  assertModeAllowed,\n  normalizePricingMode,\n  pickDefaultMode,\n  type CatalogPricingFlags,\n  type PricingMode,\n} from './pricing-mode';",
            1,
        )

    helper = """
  private catalogFlags(service: {
    allowFixed: boolean;
    allowVariable: boolean;
    allowDeposit: boolean;
    defaultPricingMode: string;
  }): CatalogPricingFlags {
    return {
      allowFixed: service.allowFixed,
      allowVariable: service.allowVariable,
      allowDeposit: service.allowDeposit,
      defaultPricingMode: service.defaultPricingMode,
    };
  }

  private resolvePricingFields(
    flags: CatalogPricingFlags,
    data: {
      pricingMode?: string;
      depositAmount?: number | null;
      estimateMinPrice?: number | null;
      estimateMaxPrice?: number | null;
      optionDeltas?: Record<string, unknown> | null;
    },
    current?: {
      pricingMode?: string | null;
      depositAmount?: number | null;
      estimateMinPrice?: number | null;
      estimateMaxPrice?: number | null;
      optionDeltas?: unknown;
    },
  ) {
    const mode: PricingMode = data.pricingMode
      ? normalizePricingMode(data.pricingMode)
      : current?.pricingMode
        ? normalizePricingMode(current.pricingMode)
        : pickDefaultMode(flags);

    try {
      assertModeAllowed(flags, mode);
    } catch {
      throw new BadRequestException(
        `حالت قیمت‌گذاری «${mode}» برای این تخصص مجاز نیست`,
      );
    }

    let depositAmount =
      data.depositAmount !== undefined ? data.depositAmount : current?.depositAmount ?? null;
    let estimateMinPrice =
      data.estimateMinPrice !== undefined
        ? data.estimateMinPrice
        : current?.estimateMinPrice ?? null;
    let estimateMaxPrice =
      data.estimateMaxPrice !== undefined
        ? data.estimateMaxPrice
        : current?.estimateMaxPrice ?? null;
    let optionDeltas =
      data.optionDeltas !== undefined
        ? data.optionDeltas
        : ((current?.optionDeltas as Record<string, unknown> | null) ?? null);

    if (mode === 'deposit') {
      if (depositAmount == null || depositAmount < 0) {
        throw new BadRequestException('مبلغ بیعانه الزامی و نامعتبر است');
      }
    }
    if (
      mode === 'variable' &&
      estimateMinPrice != null &&
      estimateMaxPrice != null &&
      estimateMinPrice > estimateMaxPrice
    ) {
      throw new BadRequestException('بازه قیمت نامعتبر است');
    }

    return {
      pricingMode: mode,
      depositAmount,
      estimateMinPrice,
      estimateMaxPrice,
      optionDeltas: optionDeltas === null ? Prisma.JsonNull : optionDeltas,
    };
  }

"""
    t = t.replace("  async upsertProfessionalService", helper + "  async upsertProfessionalService", 1)

    old_upsert = """  async upsertProfessionalService(
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
  }"""

    new_upsert = """  async upsertProfessionalService(
    userId: string,
    data: {
      serviceId: string;
      durationMin: number;
      price: number;
      bufferMin?: number;
      description?: string;
      isActive?: boolean;
      pricingMode?: string;
      depositAmount?: number;
      estimateMinPrice?: number;
      estimateMaxPrice?: number;
      optionDeltas?: Record<string, unknown>;
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

    const flags = this.catalogFlags(service);
    const pricing = this.resolvePricingFields(flags, data);

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
        pricingMode: pricing.pricingMode,
        depositAmount: pricing.depositAmount,
        estimateMinPrice: pricing.estimateMinPrice,
        estimateMaxPrice: pricing.estimateMaxPrice,
        optionDeltas: pricing.optionDeltas,
      },
      create: {
        professionalId: pro.id,
        serviceId: data.serviceId,
        durationMin: data.durationMin,
        price: data.price,
        bufferMin: data.bufferMin ?? 0,
        description: data.description,
        isActive: data.isActive ?? true,
        pricingMode: pricing.pricingMode,
        depositAmount: pricing.depositAmount,
        estimateMinPrice: pricing.estimateMinPrice,
        estimateMaxPrice: pricing.estimateMaxPrice,
        optionDeltas: pricing.optionDeltas,
      },
      include: {
        service: {
          include: {
            category: true,
            attributeGroups: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                options: {
                  where: { isActive: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
        priceRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        durationRules: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        addOns: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        mediaAssets: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }"""

    if old_upsert not in t:
        raise SystemExit("old upsert block missing")
    t = t.replace(old_upsert, new_upsert, 1)

    old_update = """  async updateProfessionalService(
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
  }"""

    new_update = """  async updateProfessionalService(
    userId: string,
    id: string,
    data: {
      durationMin?: number;
      price?: number;
      bufferMin?: number;
      description?: string;
      isActive?: boolean;
      pricingMode?: string;
      depositAmount?: number;
      estimateMinPrice?: number;
      estimateMaxPrice?: number;
      optionDeltas?: Record<string, unknown>;
    },
  ) {
    const { ps } = await this.requireOwnPs(userId, id);
    if (data.durationMin != null && data.durationMin < 5) {
      throw new BadRequestException('مدت باید حداقل ۵ دقیقه باشد');
    }
    if (data.price != null && data.price < 0) {
      throw new BadRequestException('قیمت نامعتبر است');
    }

    const service = await this.prisma.service.findUnique({ where: { id: ps.serviceId } });
    if (!service) throw new NotFoundException('خدمت یافت نشد');
    const flags = this.catalogFlags(service);
    const wantsPricing =
      data.pricingMode !== undefined ||
      data.depositAmount !== undefined ||
      data.estimateMinPrice !== undefined ||
      data.estimateMaxPrice !== undefined ||
      data.optionDeltas !== undefined;
    const pricing = wantsPricing ? this.resolvePricingFields(flags, data, ps) : null;

    return this.prisma.professionalService.update({
      where: { id },
      data: {
        ...(data.durationMin != null ? { durationMin: data.durationMin } : {}),
        ...(data.price != null ? { price: data.price } : {}),
        ...(data.bufferMin != null ? { bufferMin: data.bufferMin } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(pricing
          ? {
              pricingMode: pricing.pricingMode,
              depositAmount: pricing.depositAmount,
              estimateMinPrice: pricing.estimateMinPrice,
              estimateMaxPrice: pricing.estimateMaxPrice,
              optionDeltas: pricing.optionDeltas,
            }
          : {}),
      },
      include: {
        service: {
          include: {
            category: true,
            attributeGroups: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                options: {
                  where: { isActive: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
        addOns: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        mediaAssets: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }"""

    if old_update not in t:
        raise SystemExit("old update block missing")
    t = t.replace(old_update, new_update, 1)

    old_list = """        service: { include: { category: true } },
        priceRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        durationRules: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        addOns: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        mediaAssets: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },"""

    new_list = """        service: {
          include: {
            category: true,
            attributeGroups: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                options: {
                  where: { isActive: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
        priceRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        durationRules: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        addOns: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        mediaAssets: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },"""

    if old_list not in t:
        raise SystemExit("list include missing")
    t = t.replace(old_list, new_list, 1)

    path.write_text(t)
    print("service patched", path.stat().st_size)


if __name__ == "__main__":
    patch_controller()
    patch_service()
