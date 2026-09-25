#!/usr/bin/env python3
"""Issue #30 remaining: CatalogAddOn templates — admin CRUD + zibagar selection-only UI.
Keeps ServiceAddOn free-text backend APIs intact (upsert by name/price).
"""
from __future__ import annotations
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] if Path(__file__).parent.name == "scripts" else Path.cwd()

def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"  wrote {path.relative_to(ROOT)}")

def patch_schema() -> None:
    schema = ROOT / "backend/prisma/schema.prisma"
    text = schema.read_text(encoding="utf-8")
    if "model CatalogAddOn" in text:
        print("  schema: CatalogAddOn already present")
        return
    block = '''
model CatalogAddOn {
  id                       String   @id @default(uuid()) @db.Uuid
  name                     String   @db.VarChar(120)
  description              String?  @db.Text
  defaultPrice             Int      @default(0) @map("default_price")
  defaultExtraDurationMin  Int      @default(0) @map("default_extra_duration_min")
  sortOrder                Int      @default(0) @map("sort_order")
  isActive                 Boolean  @default(true) @map("is_active")
  createdAt                DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt                DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@index([isActive])
  @@index([sortOrder])
  @@map("catalog_add_ons")
}
'''
    if not text.endswith("\n"):
        text += "\n"
    text += block
    schema.write_text(text, encoding="utf-8")
    print("  schema: added CatalogAddOn")

def write_migration() -> None:
    mig = ROOT / "backend/prisma/migrations/20260925190000_catalog_add_ons"
    mig.mkdir(parents=True, exist_ok=True)
    write(mig / "migration.sql", '''-- Catalog add-on templates (#30)
CREATE TABLE IF NOT EXISTS "catalog_add_ons" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "default_price" INTEGER NOT NULL DEFAULT 0,
    "default_extra_duration_min" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "catalog_add_ons_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "catalog_add_ons_is_active_idx" ON "catalog_add_ons"("is_active");
CREATE INDEX IF NOT EXISTS "catalog_add_ons_sort_order_idx" ON "catalog_add_ons"("sort_order");
''')

def patch_admin_catalog() -> None:
    path = ROOT / "backend/src/admin/admin-catalog.controller.ts"
    text = path.read_text(encoding="utf-8")
    if "catalog-addons" in text or "CatalogAddOn" in text:
        print("  admin-catalog: already has catalog-addons")
        return

    dto_block = '''
class CreateCatalogAddOnDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) defaultPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) defaultExtraDurationMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

class UpdateCatalogAddOnDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) defaultPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) defaultExtraDurationMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

'''
    if "@ApiTags('admin-catalog')" in text:
        text = text.replace("@ApiTags('admin-catalog')", dto_block + "@ApiTags('admin-catalog')")

    methods = '''
  // --- Catalog Add-Ons (#30) ---
  @Get('catalog-addons')
  @ApiOperation({ summary: 'List all catalog add-on templates (admin)' })
  listCatalogAddOns() {
    return this.prisma.catalogAddOn.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  @Post('catalog-addons')
  async createCatalogAddOn(@Body() dto: CreateCatalogAddOnDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('name required');
    return this.prisma.catalogAddOn.create({
      data: {
        name,
        description: dto.description?.trim() || null,
        defaultPrice: dto.defaultPrice ?? 0,
        defaultExtraDurationMin: dto.defaultExtraDurationMin ?? 0,
        sortOrder: dto.sortOrder ?? 0,
        isActive: true,
      },
    });
  }

  @Patch('catalog-addons/:id')
  async updateCatalogAddOn(@Param('id') id: string, @Body() dto: UpdateCatalogAddOnDto) {
    const row = await this.prisma.catalogAddOn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('catalog add-on not found');
    return this.prisma.catalogAddOn.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.defaultPrice !== undefined ? { defaultPrice: dto.defaultPrice } : {}),
        ...(dto.defaultExtraDurationMin !== undefined
          ? { defaultExtraDurationMin: dto.defaultExtraDurationMin }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  @Delete('catalog-addons/:id')
  async deleteCatalogAddOn(@Param('id') id: string) {
    const row = await this.prisma.catalogAddOn.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('catalog add-on not found');
    return this.prisma.catalogAddOn.update({
      where: { id },
      data: { isActive: false },
    });
  }
'''
    idx = text.rfind("\n}")
    if idx == -1:
        raise SystemExit("could not find end of admin-catalog controller")
    text = text[:idx] + methods + text[idx:]
    path.write_text(text, encoding="utf-8")
    print("  admin-catalog: catalog-addons endpoints added")

def patch_services_controller() -> None:
    path = ROOT / "backend/src/services/services.controller.ts"
    text = path.read_text(encoding="utf-8")
    if "catalog-addons" in text:
        print("  services.controller: catalog-addons already present")
        return
    svc_path = ROOT / "backend/src/services/services.service.ts"
    svc = svc_path.read_text(encoding="utf-8")
    if "listCatalogAddOns" not in svc:
        method = '''
  /** Active catalog add-on templates for professionals to pick (#30). */
  async listCatalogAddOns() {
    return this.prisma.catalogAddOn.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        defaultPrice: true,
        defaultExtraDurationMin: true,
        sortOrder: true,
      },
    });
  }
'''
        idx = svc.rfind("\n}")
        if idx != -1:
            svc = svc[:idx] + method + svc[idx:]
            svc_path.write_text(svc, encoding="utf-8")
            print("  services.service: listCatalogAddOns added")
        else:
            print("  services.service: could not patch")
            return

    route = '''
  @Get('catalog-addons')
  @Roles('professional', 'admin', 'SUPER_ADMIN')
  @ApiBearerAuth()
  listCatalogAddOns() {
    return this.service.listCatalogAddOns();
  }
'''
    marker = "constructor(private"
    i = text.find(marker)
    if i != -1:
        j = text.find("}", i)
        if j != -1:
            text = text[: j + 1] + "\n" + route + text[j + 1 :]
            path.write_text(text, encoding="utf-8")
            print("  services.controller: GET catalog-addons added")
            return
    print("  services.controller: could not insert route")

def patch_panel_api() -> None:
    path = ROOT / "frontend/src/lib/panel-api.ts"
    text = path.read_text(encoding="utf-8")
    if "CatalogAddOnItem" in text:
        print("  panel-api: CatalogAddOnItem already present")
        return
    type_block = '''
export type CatalogAddOnItem = {
  id: string;
  name: string;
  description?: string | null;
  defaultPrice: number;
  defaultExtraDurationMin?: number;
  sortOrder?: number;
  isActive?: boolean;
};
'''
    text = text.replace(
        "export type ServiceAddOnItem = {",
        type_block + "export type ServiceAddOnItem = {",
    )
    fn = '''
export async function fetchCatalogAddOns() {
  try {
    const res = await apiClient.get<CatalogAddOnItem[] | Paginated<CatalogAddOnItem>>('/catalog-addons');
    return unwrapList(res as Paginated<CatalogAddOnItem>);
  } catch {
    return [] as CatalogAddOnItem[];
  }
}
'''
    text = text.replace(
        "export async function fetchMyAddOns(psId: string) {",
        fn + "export async function fetchMyAddOns(psId: string) {",
    )
    path.write_text(text, encoding="utf-8")
    print("  panel-api: CatalogAddOn helpers added")

def patch_service_edit_panel() -> None:
    path = ROOT / "frontend/src/app/zibagar/services/ServiceEditPanel.tsx"
    text = path.read_text(encoding="utf-8")
    if "catalogAddOns" in text or "fetchCatalogAddOns" in text:
        print("  ServiceEditPanel: catalog selection already present")
        return

    text = text.replace(
        "  deactivateMyAddOn,\n",
        "  deactivateMyAddOn,\n  fetchCatalogAddOns,\n  type CatalogAddOnItem,\n",
    )

    if "from 'react'" not in text and "useState" not in text:
        text = text.replace(
            "'use client';\n\n",
            "'use client';\n\nimport { useEffect, useState } from 'react';\n",
        )

    inject = '''
  const [catalogAddOns, setCatalogAddOns] = useState<CatalogAddOnItem[]>([]);
  useEffect(() => {
    void fetchCatalogAddOns().then(setCatalogAddOns).catch(() => setCatalogAddOns([]));
  }, []);

  function pickCatalogAddOn(id: string) {
    const item = catalogAddOns.find((c) => c.id === id);
    if (!item) return;
    setAddOnName(item.name);
    setAddOnPrice(item.defaultPrice || 0);
    setAddOnExtra(item.defaultExtraDurationMin || 0);
  }
'''
    marker = "const { selectedPs, busy,"
    i = text.find(marker)
    if i == -1:
        print("  ServiceEditPanel: could not find props destructure")
        return
    j = text.find(";\n", i)
    if j == -1:
        print("  ServiceEditPanel: could not find end of destructure")
        return
    text = text[: j + 2] + inject + text[j + 2 :]

    old_form = '''{!showAddOnForm ? <button type="button" onClick={() => setShowAddOnForm(true)} className={`text-sm font-medium ${navy.title}`}>+ افزودن ویژگی</button> : <div className="space-y-2"><div className="grid gap-2 sm:grid-cols-3"><Input placeholder="نام ویژگی" value={addOnName} onChange={(e) => setAddOnName(e.target.value)} /><Input inputMode="numeric" placeholder="قیمت" value={addOnPrice ? formatPriceDigits(addOnPrice) : ''} onChange={(e) => setAddOnPrice(parsePriceInput(e.target.value))} /><Input type="number" min={0} placeholder="زمان اضافه" value={addOnExtra || ''} onChange={(e) => setAddOnExtra(Number(e.target.value) || 0)} /></div><div className="flex gap-2"><button type="button" disabled={busy || !addOnName.trim()} onClick={onAddOn} className={`rounded-xl px-4 py-2 text-sm font-medium ${navy.btn} disabled:opacity-50`}>{editingAddOnId ? 'ذخیره تغییرات' : 'تأیید'}</button>{editingAddOnId && <button type="button" className="rounded-xl px-3 py-2 text-sm text-gray-500" onClick={() => { setEditingAddOnId(null); setAddOnName(''); setAddOnPrice(0); setAddOnExtra(0); setShowAddOnForm(false); }}>انصراف</button>}</div></div>}'''

    new_form = '''{!showAddOnForm ? <button type="button" onClick={() => setShowAddOnForm(true)} className={`text-sm font-medium ${navy.title}`}>+ افزودن ویژگی از کاتالوگ</button> : <div className="space-y-2">
          {catalogAddOns.length > 0 && !editingAddOnId ? (
            <select
              className="h-10 w-full rounded-xl border px-3 text-sm"
              value=""
              onChange={(e) => { if (e.target.value) pickCatalogAddOn(e.target.value); }}
            >
              <option value="">انتخاب از کاتالوگ ادمین...</option>
              {catalogAddOns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.defaultPrice ? ` · ${c.defaultPrice.toLocaleString('fa-IR')} ت` : ''}
                </option>
              ))}
            </select>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="نام ویژگی" value={addOnName} onChange={(e) => setAddOnName(e.target.value)} readOnly={catalogAddOns.length > 0 && !editingAddOnId} className={catalogAddOns.length > 0 && !editingAddOnId ? 'bg-gray-50' : ''} />
            <Input inputMode="numeric" placeholder="قیمت" value={addOnPrice ? formatPriceDigits(addOnPrice) : ''} onChange={(e) => setAddOnPrice(parsePriceInput(e.target.value))} />
            <Input type="number" min={0} placeholder="زمان اضافه" value={addOnExtra || ''} onChange={(e) => setAddOnExtra(Number(e.target.value) || 0)} />
          </div>
          {catalogAddOns.length === 0 && (
            <p className="text-xs text-amber-600">کاتالوگ ویژگی خالی است — ادمین باید در «تخصص‌ها و دسته‌بندی‌ها» ویژگی تعریف کند. فعلاً می‌توانید نام را دستی وارد کنید.</p>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={busy || !addOnName.trim()} onClick={onAddOn} className={`rounded-xl px-4 py-2 text-sm font-medium ${navy.btn} disabled:opacity-50`}>{editingAddOnId ? 'ذخیره تغییرات' : 'تأیید'}</button>
            {editingAddOnId && <button type="button" className="rounded-xl px-3 py-2 text-sm text-gray-500" onClick={() => { setEditingAddOnId(null); setAddOnName(''); setAddOnPrice(0); setAddOnExtra(0); setShowAddOnForm(false); }}>انصراف</button>}
            {!editingAddOnId && <button type="button" className="rounded-xl px-3 py-2 text-sm text-gray-500" onClick={() => { setShowAddOnForm(false); setAddOnName(''); setAddOnPrice(0); setAddOnExtra(0); }}>انصراف</button>}
          </div>
        </div>}'''

    if old_form not in text:
        print("  ServiceEditPanel: old form not found exactly")
        text = text.replace("+ افزودن ویژگی", "+ افزودن ویژگی از کاتالوگ")
        path.write_text(text, encoding="utf-8")
        print("  ServiceEditPanel: partial update (label + hooks)")
        return

    text = text.replace(old_form, new_form)
    path.write_text(text, encoding="utf-8")
    print("  ServiceEditPanel: catalog select UI applied")

def patch_admin_categories_page() -> None:
    path = ROOT / "frontend/src/app/admin/service-categories/page.tsx"
    text = path.read_text(encoding="utf-8")
    if "catalog-addons" in text or "CatalogAddOn" in text:
        print("  admin service-categories: catalog addons already present")
        return

    type_addon = '''
type CatalogAddOn = {
  id: string;
  name: string;
  description?: string | null;
  defaultPrice: number;
  defaultExtraDurationMin?: number;
  sortOrder?: number;
  isActive?: boolean;
};
'''
    text = text.replace(
        "type Service = {",
        type_addon + "type Service = {",
    )

    text = text.replace(
        "  const [editSvc, setEditSvc] = useState<Service | null>(null);\n",
        "  const [editSvc, setEditSvc] = useState<Service | null>(null);\n"
        "  const [catalogAddOns, setCatalogAddOns] = useState<CatalogAddOn[]>([]);\n"
        "  const [addonName, setAddonName] = useState('');\n"
        "  const [addonPrice, setAddonPrice] = useState(0);\n"
        "  const [addonExtra, setAddonExtra] = useState(0);\n",
    )

    old_load = """    const [cats, svcs] = await Promise.all([
      apiClient.get<Category[]>('/admin/service-categories'),
      apiClient.get<Service[]>('/admin/catalog-services').catch(() =>
        apiClient.get<Service[]>('/services').catch(() => []),
      ),
    ]);
    setCategories(Array.isArray(cats) ? cats : []);
    setServices(Array.isArray(svcs) ? svcs : []);"""
    new_load = """    const [cats, svcs, addons] = await Promise.all([
      apiClient.get<Category[]>('/admin/service-categories'),
      apiClient.get<Service[]>('/admin/catalog-services').catch(() =>
        apiClient.get<Service[]>('/services').catch(() => []),
      ),
      apiClient.get<CatalogAddOn[]>('/admin/catalog-addons').catch(() => []),
    ]);
    setCategories(Array.isArray(cats) ? cats : []);
    setServices(Array.isArray(svcs) ? svcs : []);
    setCatalogAddOns(Array.isArray(addons) ? addons : []);"""
    if old_load in text:
        text = text.replace(old_load, new_load)
    else:
        print("  admin page: load block not exact match")

    create_fn = '''
  async function createCatalogAddOn() {
    if (!addonName.trim()) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await apiClient.post('/admin/catalog-addons', {
        name: addonName.trim(),
        defaultPrice: addonPrice || 0,
        defaultExtraDurationMin: addonExtra || 0,
      });
      setAddonName('');
      setAddonPrice(0);
      setAddonExtra(0);
      setMessage('ویژگی کاتالوگ ثبت شد');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ایجاد ویژگی');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCatalogAddOn(id: string) {
    if (!confirm('این ویژگی غیرفعال شود؟')) return;
    setBusy(true);
    try {
      await apiClient.delete(`/admin/catalog-addons/${id}`);
      setMessage('ویژگی غیرفعال شد');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }
'''
    text = text.replace(
        "  return (\n    <div className=\"mx-auto max-w-6xl space-y-6 px-4 py-6\" dir=\"rtl\">",
        create_fn + "  return (\n    <div className=\"mx-auto max-w-6xl space-y-6 px-4 py-6\" dir=\"rtl\">",
    )

    section = '''
      <section className="rounded-2xl border border-[#FFE6E2] bg-white p-4">
        <h2 className="font-semibold text-[#0B2C4A]">ویژگی‌ها / اددآن‌های کاتالوگ</h2>
        <p className="mt-1 text-xs text-gray-500">زیباگر فقط از این لیست می‌تواند ویژگی به خدمت اضافه کند (قیمت/زمان قابل تنظیم است).</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Input value={addonName} onChange={(e) => setAddonName(e.target.value)} placeholder="نام ویژگی (مثلاً اکستنشن)" />
          <Input inputMode="numeric" value={addonPrice || ''} onChange={(e) => setAddonPrice(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)} placeholder="قیمت پیش‌فرض" />
          <Input type="number" min={0} value={addonExtra || ''} onChange={(e) => setAddonExtra(Number(e.target.value) || 0)} placeholder="زمان اضافه (دقیقه)" />
        </div>
        <button
          disabled={busy || !addonName.trim()}
          onClick={() => void createCatalogAddOn()}
          className="mt-3 rounded-xl bg-[#FF6F61] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          ثبت ویژگی کاتالوگ
        </button>
        <div className="mt-4 divide-y">
          {catalogAddOns.filter((a) => a.isActive !== false).length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">هنوز ویژگی‌ای تعریف نشده.</p>
          ) : (
            catalogAddOns.filter((a) => a.isActive !== false).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-gray-400">
                    {a.defaultPrice?.toLocaleString('fa-IR') || 0} تومان
                    {a.defaultExtraDurationMin ? ` · +${a.defaultExtraDurationMin}د` : ''}
                  </p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => void deleteCatalogAddOn(a.id)}
                  className="text-xs text-[#FF6F61]"
                >
                  حذف
                </button>
              </div>
            ))
          )}
        </div>
      </section>
'''
    end_marker = "    </div>\n  );\n}"
    if end_marker in text:
        text = text.replace(end_marker, section + end_marker)
        path.write_text(text, encoding="utf-8")
        print("  admin service-categories: catalog addons section added")
    else:
        path.write_text(text, encoding="utf-8")
        print("  admin service-categories: partial without section")

def main() -> None:
    print("Applying issue #30 catalog add-ons...")
    os.chdir(ROOT)
    patch_schema()
    write_migration()
    patch_admin_catalog()
    patch_services_controller()
    patch_panel_api()
    patch_service_edit_panel()
    patch_admin_categories_page()
    print("Done.")

if __name__ == "__main__":
    main()
