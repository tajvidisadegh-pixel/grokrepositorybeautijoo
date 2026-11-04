#!/usr/bin/env python3
"""#80 Phase2.4 — catalog pricing audit logs + dependency-aware soft delete."""
from pathlib import Path


AUDIT_HELPER = r'''
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
'''


def patch_pricing_controller() -> None:
    path = Path('backend/src/admin/admin-catalog-pricing.controller.ts')
    t = path.read_text()
    if 'catalog.pricing_flags' in t or "action: 'catalog." in t:
        print('pricing controller audit already present')
        return

    # imports
    if "CurrentUser" not in t:
        t = t.replace(
            "import { RequirePermissions } from '../common/decorators/permissions.decorator';",
            "import { RequirePermissions } from '../common/decorators/permissions.decorator';\n"
            "import { CurrentUser } from '../common/decorators/current-user.decorator';",
            1,
        )

    # helper after constructor
    if 'private async audit(' not in t:
        t = t.replace(
            "private readonly cache: AppCacheService,\n  ) {}",
            "private readonly cache: AppCacheService,\n  ) {}\n" + AUDIT_HELPER,
            1,
        )

    # updatePricingFlags — add actor + audit
    old_flags = '''  async updatePricingFlags(@Param('id') id: string, @Body() dto: UpdatePricingFlagsDto) {
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
      where: { id },'''

    new_flags = '''  async updatePricingFlags(
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
      where: { id },'''

    if old_flags in t:
        t = t.replace(old_flags, new_flags, 1)
        # close update call to capture result and audit
        # Find the update closing after pricing-flags - fragile; use simpler post-hook
        # After updatePricingFlags method's return this.prisma.service.update - already changed to const updated =
        # Need to change return of that update

    # Fix return of updatePricingFlags: look for pattern after our change
    # Typical end of method:
    #      data: { allowFixed: next.allowFixed, ... },
    #      include: this.serviceInclude(),
    #    });
    #  }
    if 'const updated = await this.prisma.service.update' in t and "catalog.pricing_flags" not in t:
        # Replace first occurrence of closing after pricing flags data
        # Use unique data fields
        frag = '''data: {
        allowFixed: next.allowFixed,
        allowVariable: next.allowVariable,
        allowDeposit: next.allowDeposit,
        defaultPricingMode: next.defaultPricingMode,
      },
      include: this.serviceInclude(),
    });
  }'''
        frag_new = '''data: {
        allowFixed: next.allowFixed,
        allowVariable: next.allowVariable,
        allowDeposit: next.allowDeposit,
        defaultPricingMode: next.defaultPricingMode,
      },
      include: this.serviceInclude(),
    });
    await this.audit(
      actorId,
      'catalog.pricing_flags',
      'service',
      id,
      {
        allowFixed: row.allowFixed,
        allowVariable: row.allowVariable,
        allowDeposit: row.allowDeposit,
        defaultPricingMode: row.defaultPricingMode,
      },
      next,
    );
    return updated;
  }'''
        if frag in t:
            t = t.replace(frag, frag_new, 1)
        else:
            print('WARN: pricing flags return frag not found')

    # createAttributeGroup — audit
    if "catalog.attribute_group.create" not in t:
        t = t.replace(
            "async createAttributeGroup(@Param('id') id: string, @Body() dto: UpsertAttributeGroupDto)",
            "async createAttributeGroup(@Param('id') id: string, @Body() dto: UpsertAttributeGroupDto, @CurrentUser('id') actorId?: string)",
            1,
        )
        # after create return
        old_cg = '''    return this.prisma.serviceAttributeGroup.create({
      data: {
        serviceId: id,
        name: dto.name.trim(),
        required: dto.required ?? true,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }'''
        new_cg = '''    const created = await this.prisma.serviceAttributeGroup.create({
      data: {
        serviceId: id,
        name: dto.name.trim(),
        required: dto.required ?? true,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit(actorId, 'catalog.attribute_group.create', 'service_attribute_group', created.id, null, created);
    return created;
  }'''
        if old_cg in t:
            t = t.replace(old_cg, new_cg, 1)

    # deleteAttributeGroup
    if "catalog.attribute_group.deactivate" not in t:
        t = t.replace(
            "async deleteAttributeGroup(@Param('groupId') groupId: string)",
            "async deleteAttributeGroup(@Param('groupId') groupId: string, @CurrentUser('id') actorId?: string)",
            1,
        )
        old_dg = '''    await this.prisma.serviceAttributeGroup.update({
      where: { id: groupId },
      data: { isActive: false },
    });
    return { id: groupId, deleted: true, hard: false };
  }'''
        new_dg = '''    await this.prisma.serviceAttributeGroup.update({
      where: { id: groupId },
      data: { isActive: false },
    });
    await this.audit(actorId, 'catalog.attribute_group.deactivate', 'service_attribute_group', groupId, { isActive: true }, { isActive: false });
    return { id: groupId, deleted: true, hard: false };
  }'''
        if old_dg in t:
            t = t.replace(old_dg, new_dg, 1)

    # createAttributeOption
    if "catalog.attribute_option.create" not in t:
        t = t.replace(
            "async createAttributeOption(@Param('groupId') groupId: string, @Body() dto: UpsertAttributeOptionDto)",
            "async createAttributeOption(@Param('groupId') groupId: string, @Body() dto: UpsertAttributeOptionDto, @CurrentUser('id') actorId?: string)",
            1,
        )
        old_co = '''    return this.prisma.serviceAttributeOption.create({
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
  }'''
        new_co = '''    const created = await this.prisma.serviceAttributeOption.create({
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
  }'''
        if old_co in t:
            t = t.replace(old_co, new_co, 1)

    # deleteAttributeOption
    if "catalog.attribute_option.deactivate" not in t:
        t = t.replace(
            "async deleteAttributeOption(@Param('optionId') optionId: string)",
            "async deleteAttributeOption(@Param('optionId') optionId: string, @CurrentUser('id') actorId?: string)",
            1,
        )
        old_do = '''    await this.prisma.serviceAttributeOption.update({
      where: { id: optionId },
      data: { isActive: false },
    });
    return { id: optionId, deleted: true, hard: false };
  }'''
        new_do = '''    await this.prisma.serviceAttributeOption.update({
      where: { id: optionId },
      data: { isActive: false },
    });
    await this.audit(actorId, 'catalog.attribute_option.deactivate', 'service_attribute_option', optionId, { isActive: true }, { isActive: false });
    return { id: optionId, deleted: true, hard: false };
  }'''
        if old_do in t:
            t = t.replace(old_do, new_do, 1)

    # applyTemplate audit
    if "catalog.template.apply" not in t and 'async applyTemplate' in t:
        t = t.replace(
            "async applyTemplate(@Param('id') serviceId: string, @Body() dto: ApplyTemplateDto)",
            "async applyTemplate(@Param('id') serviceId: string, @Body() dto: ApplyTemplateDto, @CurrentUser('id') actorId?: string)",
            1,
        )
        if "return { serviceId, templateId: tpl.id, groupsCreated: created.length, groups: created };" in t:
            t = t.replace(
                "return { serviceId, templateId: tpl.id, groupsCreated: created.length, groups: created };",
                "const result = { serviceId, templateId: tpl.id, groupsCreated: created.length, groups: created };\n"
                "    await this.audit(actorId, 'catalog.template.apply', 'service', serviceId, null, { templateId: tpl.id, groupsCreated: created.length });\n"
                "    return result;",
                1,
            )

    path.write_text(t)
    print('pricing controller patched', path.stat().st_size)


def patch_catalog_controller() -> None:
    path = Path('backend/src/admin/admin-catalog.controller.ts')
    t = path.read_text()
    if 'dependentOffers' in t and 'catalog.service.deactivate' in t:
        print('catalog controller already has dependency + audit')
        return

    if 'CurrentUser' not in t:
        t = t.replace(
            "import { RequirePermissions } from '../common/decorators/permissions.decorator';",
            "import { RequirePermissions } from '../common/decorators/permissions.decorator';\n"
            "import { CurrentUser } from '../common/decorators/current-user.decorator';",
            1,
        )

    if 'private async audit(' not in t:
        # after constructor
        if 'constructor(' in t:
            # find constructor end
            t = t.replace(
                "private readonly cache: AppCacheService,\n  ) {}",
                "private readonly cache: AppCacheService,\n  ) {}\n" + AUDIT_HELPER,
                1,
            )

    old_del = '''  async deleteCatalogService(@Param('id') id: string) {
    const row = await this.prisma.service.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('service not found');
    this.cache.invalidateCatalog();
    const updated = await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    return { id, deleted: true, hard: false, isActive: updated.isActive };
  }'''
    new_del = '''  async deleteCatalogService(
    @Param('id') id: string,
    @CurrentUser('id') actorId?: string,
  ) {
    const row = await this.prisma.service.findUnique({
      where: { id },
      include: { _count: { select: { professionalServices: true, variants: true } } },
    });
    if (!row) throw new NotFoundException('service not found');
    const dependentOffers = row._count.professionalServices;
    const variantCount = row._count.variants;
    this.cache.invalidateCatalog();
    const updated = await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    await this.audit(
      actorId,
      'catalog.service.deactivate',
      'service',
      id,
      { isActive: row.isActive, name: row.name },
      { isActive: false, dependentOffers, variantCount },
    );
    return {
      id,
      deleted: true,
      hard: false,
      isActive: updated.isActive,
      dependentOffers,
      variantCount,
      warning:
        dependentOffers > 0
          ? `${dependentOffers} پیشنهاد فعال زیباگر به این خدمت وابسته است؛ حذف سخت انجام نشد و فقط غیرفعال شد.`
          : undefined,
    };
  }'''
    if old_del not in t:
        print('WARN: deleteCatalogService block not found')
    else:
        t = t.replace(old_del, new_del, 1)

    # createVariant audit
    if 'catalog.variant.create' not in t and 'async createVariant' in t:
        t = t.replace(
            "async createVariant(@Param('id') id: string, @Body() dto: CreateVariantDto)",
            "async createVariant(@Param('id') id: string, @Body() dto: CreateVariantDto, @CurrentUser('id') actorId?: string)",
            1,
        )
        # after return this.prisma.service.create in createVariant - add audit before return
        # Look for createVariant body return
        marker = "include: { category: { select: { id: true, name: true, slug: true } } },\n    });\n  }\n"
        # only replace last occurrence in createVariant is hard; use unique parentId: parent.id block
        unique = '''        parentId: parent.id,
        allowFixed: parent.allowFixed,
        allowVariable: parent.allowVariable,
        allowDeposit: parent.allowDeposit,
        defaultPricingMode: parent.defaultPricingMode,
        isActive: true,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }'''
        unique_new = '''        parentId: parent.id,
        allowFixed: parent.allowFixed,
        allowVariable: parent.allowVariable,
        allowDeposit: parent.allowDeposit,
        defaultPricingMode: parent.defaultPricingMode,
        isActive: true,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    await this.audit(actorId, 'catalog.variant.create', 'service', created.id, null, { parentId: parent.id, name: created.name });
    return created;
  }'''
        if unique in t:
            t = t.replace(
                unique,
                unique.replace(
                    'return this.prisma.service.create({\n      data: {',
                    'const created = await this.prisma.service.create({\n      data: {',
                ) if False else '''        parentId: parent.id,
        allowFixed: parent.allowFixed,
        allowVariable: parent.allowVariable,
        allowDeposit: parent.allowDeposit,
        defaultPricingMode: parent.defaultPricingMode,
        isActive: true,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    await this.audit(actorId, 'catalog.variant.create', 'service', created.id, null, { parentId: parent.id, name: created.name });
    return created;
  }''',
                1,
            )
            # Fix create call to const created =
            t = t.replace(
                '''    return this.prisma.service.create({
      data: {
        name,
        slug,
        categoryId: parent.categoryId,
        description: dto.description?.trim() || null,
        parentId: parent.id,''',
                '''    const created = await this.prisma.service.create({
      data: {
        name,
        slug,
        categoryId: parent.categoryId,
        description: dto.description?.trim() || null,
        parentId: parent.id,''',
                1,
            )

    path.write_text(t)
    print('catalog controller patched', path.stat().st_size)


def patch_frontend_delete_warning() -> None:
    path = Path('frontend/src/app/admin/service-categories/page.tsx')
    if not path.exists():
        print('no admin service-categories page')
        return
    t = path.read_text()
    if 'dependentOffers' in t:
        print('frontend delete warning exists')
        return
    # find deleteService function
    if 'async function deleteService' not in t and 'deleteService' not in t:
        print('deleteService not found')
        return
    # Soft enhance confirm message
    old = "if (!confirm('این خدمت حذف شود؟')) return;"
    new = (
        "if (!confirm('این خدمت غیرفعال شود؟ اگر زیباگری آن را ارائه می‌دهد، پیشنهاد او باقی می‌ماند ولی خدمت از کاتالوگ عمومی حذف می‌شود.')) return;"
    )
    if old in t:
        t = t.replace(old, new, 1)
    # after delete API call, show warning from response if any
    # try common pattern
    if 'await apiClient.delete' in t and 'dependentOffers' not in t:
        # leave as is if complex
        pass
    path.write_text(t)
    print('frontend patched', path.stat().st_size)


if __name__ == '__main__':
    patch_pricing_controller()
    patch_catalog_controller()
    patch_frontend_delete_warning()
