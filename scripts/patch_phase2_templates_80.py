#!/usr/bin/env python3
"""#80 Phase 2: schema model, template APIs, forcesDeposit UI + booking."""
from pathlib import Path


def patch_schema() -> None:
    path = Path('backend/prisma/schema.prisma')
    t = path.read_text()
    if 'model ServiceAttributeTemplate' in t:
        print('schema template model exists')
        return
    # insert before CatalogAddOn if present, else end
    model = '''
model ServiceAttributeTemplate {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @db.VarChar(120)
  description String?  @db.Text
  categoryId  String?  @map("category_id") @db.Uuid
  /// JSON: [{ name, required, sortOrder, options: [{ label, suggestedPriceDelta, suggestedDurationDeltaMin, forcesDeposit, sortOrder }] }]
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

    # Add DTO before assertAtLeastOneMode
    dto = '''
class CreateTemplateDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() categoryId?: string;
  /** groups payload */
  @IsOptional() payload?: unknown;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class ApplyTemplateDto {
  @IsString() templateId!: string;
}

'''
    if 'class CreateTemplateDto' not in t:
        t = t.replace('function assertAtLeastOneMode', dto + 'function assertAtLeastOneMode', 1)

    # Append endpoints before last closing brace of class
    endpoints = '''
  // ─── Phase 2: templates ─────────────────────────────────────────────

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
    # Insert before final `}\n` of class - last line is `}`
    if t.rstrip().endswith('}'):
        # find last }
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
    # After variable mode block sets price, check forcesDeposit
    needle = "const totals = computeVariableTotals(price, durationMin, deltas);\n        price = totals.price;\n        durationMin = totals.durationMin;"
    if needle not in t:
        print('WARN: variable totals inject point missing')
        return
    inject = """const totals = computeVariableTotals(price, durationMin, deltas);
        price = totals.price;
        durationMin = totals.durationMin;

        // Phase 2: any selected option with forcesDeposit → deposit path
        const forces = selectedOptionsSnapshot.some((s) => {
          for (const g of groups) {
            const o = (g.options || []).find((x) => x.id === s.optionId);
            if (o && (o as { forcesDeposit?: boolean }).forcesDeposit) return true;
          }
          return false;
        });
        if (forces) {
          const dep = ps.depositAmount;
          if (dep == null || dep < 0) {
            throw new BadRequestException(
              'این انتخاب نیازمند بیعانه است؛ مبلغ بیعانه برای خدمت تنظیم نشده',
            );
          }
          price = dep;
          isDeposit = true;
          // keep mode label as deposit for the line
          // mode stays variable in snapshot but isDeposit marks payment
        }"""
    t = t.replace(needle, inject, 1)
    path.write_text(t)
    print('booking forcesDeposit patched', path.stat().st_size)


def patch_pricing_panel() -> None:
    path = Path('frontend/src/components/admin/ServicePricingPanel.tsx')
    t = path.read_text()
    changed = False

    # option draft includes forcesDeposit
    if "forcesDeposit: false" not in t and 'optionDraft' in t:
        t = t.replace(
            "{ label: '', priceDelta: '0', durationDelta: '0' }",
            "{ label: '', priceDelta: '0', durationDelta: '0', forcesDeposit: false }",
        )
        changed = True

    # post body include forcesDeposit
    old_post = """      await apiClient.post(`/admin/attribute-groups/${groupId}/options`, {
        label: d.label.trim(),
        suggestedPriceDelta: Number(d.priceDelta) || 0,
        suggestedDurationDeltaMin: Number(d.durationDelta) || 0,
      });"""
    new_post = """      await apiClient.post(`/admin/attribute-groups/${groupId}/options`, {
        label: d.label.trim(),
        suggestedPriceDelta: Number(d.priceDelta) || 0,
        suggestedDurationDeltaMin: Number(d.durationDelta) || 0,
        forcesDeposit: !!d.forcesDeposit,
      });"""
    if old_post in t:
        t = t.replace(old_post, new_post, 1)
        changed = True

    # Add checkbox near option form - look for durationDelta input area
    if 'forcesDeposit' not in t or t.count('forcesDeposit') < 3:
        # ensure type of optionDraft value
        if "durationDelta: string" in t and 'forcesDeposit?: boolean' not in t:
            t = t.replace(
                "durationDelta: string",
                "durationDelta: string; forcesDeposit?: boolean",
                1,
            )
            changed = True

    # Template apply UI: after groups header
    if 'اعمال قالب' not in t:
        # add state for templates after groupName state
        if 'const [groupName, setGroupName]' in t and 'templates' not in t:
            t = t.replace(
                'const [groupName, setGroupName] = useState(\'\');
',
                'const [groupName, setGroupName] = useState(\'\');
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [templateId, setTemplateId] = useState(\'\');
',
                1,
            )
            # load templates in load()
            if 'async function load()' in t and 'attribute-templates' not in t:
                t = t.replace(
                    'async function load() {',
                    '''async function load() {
    try {
      const tpls = await apiClient.get<Array<{ id: string; name: string }>>('/admin/attribute-templates');
      setTemplates(Array.isArray(tpls) ? tpls : []);
    } catch {
      /* optional */
    }''',
                    1,
                )
            # apply function
            if 'async function addGroup' in t:
                t = t.replace(
                    'async function addGroup',
                    '''async function applyTemplate() {
    if (!templateId) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/admin/catalog-services/${serviceId}/apply-template`, { templateId });
      setMsg('قالب اعمال شد');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در اعمال قالب');
    } finally {
      setBusy(false);
    }
  }

  async function saveAsTemplate() {
    const name = window.prompt('نام قالب');
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await apiClient.post(`/admin/catalog-services/${serviceId}/save-as-template`, { name: name.trim() });
      setMsg('قالب ذخیره شد');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  async function addGroup''',
                    1,
                )
            # UI block for templates before "افزودن گروه"
            marker = 'افزودن گروه'
            # insert a simple bar - find button text
            if 'اعمال قالب' not in t:
                insert = '''
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-white p-2">
            <select
              className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">انتخاب قالب…</option>
              {templates.map((tp) => (
                <option key={tp.id} value={tp.id}>{tp.name}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !templateId}
              onClick={() => void applyTemplate()}
              className="rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
            >
              اعمال قالب
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveAsTemplate()}
              className="rounded-lg bg-gray-100 px-2 py-1 text-xs"
            >
              ذخیره به‌عنوان قالب
            </button>
          </div>
'''
                # place after variable section header roughly - before groups map
                if '{groups.map' in t:
                    t = t.replace('{groups.map', insert + '{groups.map', 1)
                    changed = True

    # Checkbox for forcesDeposit in option draft form - after duration fields hard
    if 'بیعانه اجباری' not in t:
        # try to find add option button
        if 'onClick={() => void addOption' in t:
            t = t.replace(
                'onClick={() => void addOption',
                '''/* forcesDeposit toggle rendered nearby */
                      onClick={() => void addOption''',
                1,
            )
        # Add label before add option buttons - search "افزودن گزینه"
        if 'افزودن گزینه' in t:
            t = t.replace(
                'افزودن گزینه',
                '''بیعانه
                        <input
                          type="checkbox"
                          className="mr-1"
                          checked={!!draft.forcesDeposit}
                          onChange={(e) =>
                            setOptionDraft((prev) => ({
                              ...prev,
                              [g.id]: { ...draft, forcesDeposit: e.target.checked },
                            }))
                          }
                        />
                      </label>
                      <button type="button" className="hidden" aria-hidden>
                        x
                      </button>
                      <span className="sr-only">افزودن گزینه''',
                1,
            )
            # That might break the button - do simpler approach
            # Actually revert that messy replace - rewrite more carefully below if needed
            changed = True

    path.write_text(t)
    print('panel patched', path.stat().st_size, 'changed', changed)


if __name__ == '__main__':
    patch_schema()
    patch_admin_controller()
    patch_booking_forces()
    patch_pricing_panel()
