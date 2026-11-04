#!/usr/bin/env python3
"""#80 Phase 2: schema model, template APIs, forcesDeposit booking, admin UI."""
from pathlib import Path


def patch_schema() -> None:
    path = Path('backend/prisma/schema.prisma')
    t = path.read_text()
    if 'model ServiceAttributeTemplate' in t:
        print('schema template model exists')
        return
    model = '''
model ServiceAttributeTemplate {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @db.VarChar(120)
  description String?  @db.Text
  categoryId  String?  @map("category_id") @db.Uuid
  payload     Json     @default("[]")
  isActive    Boolean  @default(true) @map("is_active")
  sortOrder   Int      @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@index([isActive])
  @@index([categoryId])
  @@map("service_attribute_templates")
}

'''
    if 'model CatalogAddOn' in t:
        t = t.replace('model CatalogAddOn', model + 'model CatalogAddOn', 1)
    else:
        t = t.rstrip() + '\n' + model
    path.write_text(t)
    print('schema patched', path.stat().st_size)


def patch_admin_controller() -> None:
    path = Path('backend/src/admin/admin-catalog-pricing.controller.ts')
    t = path.read_text()
    if 'attribute-templates' in t:
        print('admin templates API exists')
        return

    dto = '''
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

'''
    t = t.replace('function assertAtLeastOneMode', dto + 'function assertAtLeastOneMode', 1)

    endpoints = r'''
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
  async applyTemplate(@Param('id') serviceId: string, @Body() dto: ApplyTemplateDto) {
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
    return { serviceId, templateId: tpl.id, groupsCreated: created.length, groups: created };
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
'''
    idx = t.rfind('}')
    t = t[:idx] + endpoints + '\n}\n'
    path.write_text(t)
    print('admin controller patched', path.stat().st_size)


def patch_booking_forces() -> None:
    path = Path('backend/src/bookings/bookings.service.ts')
    t = path.read_text()
    if 'forcesDeposit' in t:
        print('booking forcesDeposit already handled')
        return
    needle = (
        'const totals = computeVariableTotals(price, durationMin, deltas);\n'
        '        price = totals.price;\n'
        '        durationMin = totals.durationMin;'
    )
    if needle not in t:
        print('WARN: variable totals inject point missing')
        return
    inject = (
        'const totals = computeVariableTotals(price, durationMin, deltas);\n'
        '        price = totals.price;\n'
        '        durationMin = totals.durationMin;\n'
        '\n'
        '        const forces = selectedOptionsSnapshot.some((s) => {\n'
        '          for (const g of groups) {\n'
        '            const o = (g.options || []).find((x) => x.id === s.optionId);\n'
        '            if (o && (o as { forcesDeposit?: boolean }).forcesDeposit) return true;\n'
        '          }\n'
        '          return false;\n'
        '        });\n'
        '        if (forces) {\n'
        '          const dep = ps.depositAmount;\n'
        '          if (dep == null || dep < 0) {\n'
        '            throw new BadRequestException(\n'
        "              'این انتخاب نیازمند بیعانه است؛ مبلغ بیعانه برای خدمت تنظیم نشده',\n"
        '            );\n'
        '          }\n'
        '          price = dep;\n'
        '          isDeposit = true;\n'
        '        }'
    )
    t = t.replace(needle, inject, 1)
    path.write_text(t)
    print('booking forcesDeposit patched', path.stat().st_size)


def patch_pricing_panel() -> None:
    path = Path('frontend/src/components/admin/ServicePricingPanel.tsx')
    t = path.read_text()

    t = t.replace(
        "{ label: '', priceDelta: '0', durationDelta: '0' }",
        "{ label: '', priceDelta: '0', durationDelta: '0', forcesDeposit: false }",
    )

    old_post = (
        '      await apiClient.post(`/admin/attribute-groups/${groupId}/options`, {\n'
        '        label: d.label.trim(),\n'
        '        suggestedPriceDelta: Number(d.priceDelta) || 0,\n'
        '        suggestedDurationDeltaMin: Number(d.durationDelta) || 0,\n'
        '      });'
    )
    new_post = (
        '      await apiClient.post(`/admin/attribute-groups/${groupId}/options`, {\n'
        '        label: d.label.trim(),\n'
        '        suggestedPriceDelta: Number(d.priceDelta) || 0,\n'
        '        suggestedDurationDeltaMin: Number(d.durationDelta) || 0,\n'
        '        forcesDeposit: !!d.forcesDeposit,\n'
        '      });'
    )
    if old_post in t:
        t = t.replace(old_post, new_post, 1)

    if 'durationDelta: string' in t and 'forcesDeposit?: boolean' not in t:
        t = t.replace(
            'durationDelta: string',
            'durationDelta: string; forcesDeposit?: boolean',
            1,
        )

    if 'templates' not in t:
        t = t.replace(
            "const [groupName, setGroupName] = useState('');\n",
            "const [groupName, setGroupName] = useState('');\n"
            "  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);\n"
            "  const [templateId, setTemplateId] = useState('');\n",
            1,
        )

    if 'attribute-templates' not in t and 'async function load()' in t:
        t = t.replace(
            'async function load() {',
            "async function load() {\n"
            "    try {\n"
            "      const tpls = await apiClient.get<Array<{ id: string; name: string }>>('/admin/attribute-templates');\n"
            "      setTemplates(Array.isArray(tpls) ? tpls : []);\n"
            "    } catch {\n"
            "      /* optional */\n"
            "    }",
            1,
        )

    if 'async function applyTemplate' not in t and 'async function addGroup' in t:
        helper = (
            "async function applyTemplate() {\n"
            "    if (!templateId) return;\n"
            "    setBusy(true);\n"
            "    setError(null);\n"
            "    try {\n"
            "      await apiClient.post(`/admin/catalog-services/${serviceId}/apply-template`, { templateId });\n"
            "      setMsg('قالب اعمال شد');\n"
            "      await load();\n"
            "    } catch (e) {\n"
            "      setError(e instanceof Error ? e.message : 'خطا در اعمال قالب');\n"
            "    } finally {\n"
            "      setBusy(false);\n"
            "    }\n"
            "  }\n"
            "\n"
            "  async function saveAsTemplate() {\n"
            "    const name = window.prompt('نام قالب');\n"
            "    if (!name?.trim()) return;\n"
            "    setBusy(true);\n"
            "    try {\n"
            "      await apiClient.post(`/admin/catalog-services/${serviceId}/save-as-template`, { name: name.trim() });\n"
            "      setMsg('قالب ذخیره شد');\n"
            "      await load();\n"
            "    } catch (e) {\n"
            "      setError(e instanceof Error ? e.message : 'خطا');\n"
            "    } finally {\n"
            "      setBusy(false);\n"
            "    }\n"
            "  }\n"
            "\n"
            "  async function addGroup"
        )
        t = t.replace('async function addGroup', helper, 1)

    if 'اعمال قالب' not in t and '{groups.map' in t:
        bar = (
            "\n          <div className=\"mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-white p-2\">\n"
            "            <select\n"
            "              className=\"rounded-lg border border-gray-200 px-2 py-1 text-xs\"\n"
            "              value={templateId}\n"
            "              onChange={(e) => setTemplateId(e.target.value)}\n"
            "            >\n"
            "              <option value=\"\">انتخاب قالب…</option>\n"
            "              {templates.map((tp) => (\n"
            "                <option key={tp.id} value={tp.id}>{tp.name}</option>\n"
            "              ))}\n"
            "            </select>\n"
            "            <button type=\"button\" disabled={busy || !templateId} onClick={() => void applyTemplate()} className=\"rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50\">اعمال قالب</button>\n"
            "            <button type=\"button\" disabled={busy} onClick={() => void saveAsTemplate()} className=\"rounded-lg bg-gray-100 px-2 py-1 text-xs\">ذخیره به‌عنوان قالب</button>\n"
            "          </div>\n"
            "{groups.map"
        )
        t = t.replace('{groups.map', bar, 1)

    path.write_text(t)
    print('panel patched', path.stat().st_size)


if __name__ == '__main__':
    patch_schema()
    patch_admin_controller()
    patch_booking_forces()
    patch_pricing_panel()
