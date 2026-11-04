#!/usr/bin/env python3
"""#80 Phase2.3 — Service variants (parentId) schema, admin API, pricing panel UI."""
from pathlib import Path


def patch_schema() -> None:
    path = Path('backend/prisma/schema.prisma')
    t = path.read_text()
    if 'ServiceVariants' in t:
        print('schema variants already present')
        return
    old = '''model Service {
  id          String   @id @default(uuid()) @db.Uuid
  categoryId  String   @map("category_id") @db.Uuid
  name        String   @db.VarChar(150)
  slug        String   @unique @db.VarChar(160)
  description String?  @db.Text
  isActive    Boolean  @default(true) @map("is_active")
  sortOrder   Int      @default(0) @map("sort_order")
  allowFixed          Boolean @default(true)  @map("allow_fixed")
  allowVariable       Boolean @default(false) @map("allow_variable")
  allowDeposit        Boolean @default(false) @map("allow_deposit")
  defaultPricingMode  String  @default("fixed") @map("default_pricing_mode") @db.VarChar(20)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz
  category             ServiceCategory      @relation(fields: [categoryId], references: [id])
  professionalServices ProfessionalService[]
  bookingItems         BookingItem[]
  attributeGroups      ServiceAttributeGroup[]
  @@index([categoryId])
  @@index([isActive])
  @@map("services")
}'''
    new = '''model Service {
  id          String   @id @default(uuid()) @db.Uuid
  categoryId  String   @map("category_id") @db.Uuid
  name        String   @db.VarChar(150)
  slug        String   @unique @db.VarChar(160)
  description String?  @db.Text
  isActive    Boolean  @default(true) @map("is_active")
  sortOrder   Int      @default(0) @map("sort_order")
  parentId    String?  @map("parent_id") @db.Uuid
  allowFixed          Boolean @default(true)  @map("allow_fixed")
  allowVariable       Boolean @default(false) @map("allow_variable")
  allowDeposit        Boolean @default(false) @map("allow_deposit")
  defaultPricingMode  String  @default("fixed") @map("default_pricing_mode") @db.VarChar(20)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz
  category             ServiceCategory      @relation(fields: [categoryId], references: [id])
  parent               Service?             @relation("ServiceVariants", fields: [parentId], references: [id], onDelete: SetNull)
  variants             Service[]            @relation("ServiceVariants")
  professionalServices ProfessionalService[]
  bookingItems         BookingItem[]
  attributeGroups      ServiceAttributeGroup[]
  @@index([categoryId])
  @@index([isActive])
  @@index([parentId])
  @@map("services")
}'''
    if old not in t:
        raise SystemExit('Service model block not found for variant patch')
    path.write_text(t.replace(old, new, 1))
    print('schema patched', path.stat().st_size)


def patch_admin_catalog() -> None:
    path = Path('backend/src/admin/admin-catalog.controller.ts')
    t = path.read_text()
    if 'catalog-services/:id/variants' in t:
        print('admin catalog variants already present')
        return

    if 'class CreateVariantDto' not in t:
        t = t.replace(
            '''class CreateCatalogServiceDto {
  @IsString() @MinLength(1) name!: string;
  @IsUUID() categoryId!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
}''',
            '''class CreateCatalogServiceDto {
  @IsString() @MinLength(1) name!: string;
  @IsUUID() categoryId!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() parentId?: string | null;
}

class CreateVariantDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() slug?: string;
}''',
            1,
        )

    if 'parentId: dto.parentId' not in t:
        marker = 'description: dto.description?.trim() || null,'
        if marker in t:
            t = t.replace(
                marker,
                marker + '\n        parentId: dto.parentId || null,',
                1,
            )

    endpoints = r'''
  @Get('catalog-services/:id/variants')
  @ApiOperation({ summary: 'List variants (sub-services) of a catalog service (#80.2)' })
  async listVariants(@Param('id') id: string) {
    const parent = await this.prisma.service.findUnique({ where: { id } });
    if (!parent) throw new NotFoundException('service not found');
    return this.prisma.service.findMany({
      where: { parentId: id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  @Post('catalog-services/:id/variants')
  @ApiOperation({ summary: 'Create a variant under a catalog service (#80.2)' })
  async createVariant(@Param('id') id: string, @Body() dto: CreateVariantDto) {
    const parent = await this.prisma.service.findUnique({ where: { id } });
    if (!parent) throw new NotFoundException('service not found');
    if (parent.parentId) {
      throw new BadRequestException('نمی‌توان زیرِ یک واریانت، واریانت ساخت');
    }
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('name required');
    let slug = (dto.slug || slugify(`${parent.slug}-${name}`)).trim();
    const clash = await this.prisma.service.findUnique({ where: { slug } });
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;
    this.cache.invalidateCatalog();
    return this.prisma.service.create({
      data: {
        name,
        slug,
        categoryId: parent.categoryId,
        description: dto.description?.trim() || null,
        parentId: parent.id,
        allowFixed: parent.allowFixed,
        allowVariable: parent.allowVariable,
        allowDeposit: parent.allowDeposit,
        defaultPricingMode: parent.defaultPricingMode,
        isActive: true,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }
'''
    idx = t.rfind('}')
    t = t[:idx] + endpoints + '\n}\n'
    path.write_text(t)
    print('admin-catalog patched', path.stat().st_size)


def patch_pricing_panel() -> None:
    path = Path('frontend/src/components/admin/ServicePricingPanel.tsx')
    t = path.read_text()
    if 'افزودن واریانت' in t:
        print('panel variants UI exists')
        return

    anchor_state = "const [groupName, setGroupName] = useState('');\n"
    state_extra = (
        "const [groupName, setGroupName] = useState('');\n"
        "  const [variants, setVariants] = useState<Array<{ id: string; name: string; isActive?: boolean }>>([]);\n"
        "  const [variantName, setVariantName] = useState('');\n"
    )
    if anchor_state in t and 'const [variants' not in t:
        t = t.replace(anchor_state, state_extra, 1)

    if '/variants' not in t:
        t = t.replace(
            'async function load() {',
            (
                'async function load() {\n'
                '    try {\n'
                '      const vs = await apiClient.get<Array<{ id: string; name: string; isActive?: boolean }>>(`/admin/catalog-services/${serviceId}/variants`);\n'
                '      setVariants(Array.isArray(vs) ? vs : []);\n'
                '    } catch {\n'
                '      setVariants([]);\n'
                '    }'
            ),
            1,
        )

    if 'async function addVariant' not in t:
        helper = (
            'async function addVariant() {\n'
            '    if (!variantName.trim()) return;\n'
            '    setBusy(true);\n'
            '    setError(null);\n'
            '    try {\n'
            '      await apiClient.post(`/admin/catalog-services/${serviceId}/variants`, { name: variantName.trim() });\n'
            "      setVariantName('');\n"
            "      setMsg('واریانت اضافه شد');\n"
            '      await load();\n'
            '    } catch (e) {\n'
            "      setError(e instanceof Error ? e.message : 'خطا در افزودن واریانت');\n"
            '    } finally {\n'
            '      setBusy(false);\n'
            '    }\n'
            '  }\n\n'
        )
        if 'async function addGroup' in t:
            t = t.replace('async function addGroup', helper + 'async function addGroup', 1)
        elif 'async function saveFlags' in t:
            t = t.replace('async function saveFlags', helper + 'async function saveFlags', 1)

    if 'افزودن واریانت' not in t:
        block = (
            '\n'
            '      <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-3">\n'
            '        <p className="text-xs font-semibold text-[#0B2C4A]">زیرخدمت / واریانت</p>\n'
            '        <p className="mt-0.5 text-[11px] text-gray-500">\n'
            '          مثلاً «بالیاژ ملایم» و «بالیاژ کامل» زیر یک خدمت. هر واریانت خدمت جدا است و حالت قیمت را از والد به ارث می‌برد.\n'
            '        </p>\n'
            '        <ul className="mt-2 space-y-1">\n'
            '          {variants.length === 0 && (\n'
            '            <li className="text-[11px] text-gray-400">واریانتی تعریف نشده</li>\n'
            '          )}\n'
            '          {variants.map((v) => (\n'
            '            <li key={v.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 text-xs">\n'
            "              <span>{v.name}{v.isActive === false ? ' (غیرفعال)' : ''}</span>\n"
            '            </li>\n'
            '          ))}\n'
            '        </ul>\n'
            '        <div className="mt-2 flex flex-wrap gap-2">\n'
            '          <Input\n'
            '            value={variantName}\n'
            '            onChange={(e) => setVariantName(e.target.value)}\n'
            '            placeholder="نام واریانت"\n'
            '            className="max-w-xs"\n'
            '          />\n'
            '          <button\n'
            '            type="button"\n'
            '            disabled={busy || !variantName.trim()}\n'
            '            onClick={() => void addVariant()}\n'
            '            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-white disabled:opacity-50"\n'
            '          >\n'
            '            افزودن واریانت\n'
            '          </button>\n'
            '        </div>\n'
            '      </div>\n'
        )
        if 'حالت‌های قیمت مجاز' in t:
            t = t.replace('حالت‌های قیمت مجاز', block + 'حالت‌های قیمت مجاز', 1)

    path.write_text(t)
    print('panel patched', path.stat().st_size)


if __name__ == '__main__':
    patch_schema()
    patch_admin_catalog()
    patch_pricing_panel()
