from pathlib import Path
import re

# --- admin-catalog.controller: inject cache + invalidate ---
p = Path('backend/src/admin/admin-catalog.controller.ts')
t = p.read_text(encoding='utf-8')
if 'AppCacheService' not in t:
    t = t.replace(
        "import { PrismaService } from '../prisma/prisma.service';",
        "import { PrismaService } from '../prisma/prisma.service';\nimport { AppCacheService } from '../cache/app-cache.service';",
        1,
    )
    # find constructor
    if 'constructor(private readonly prisma: PrismaService)' in t:
        t = t.replace(
            'constructor(private readonly prisma: PrismaService)',
            'constructor(\n    private readonly prisma: PrismaService,\n    private readonly cache: AppCacheService,\n  )',
            1,
        )
    elif 'constructor(' in t and 'AppCacheService' not in t:
        t = re.sub(
            r'constructor\(([^)]*)\)',
            r'constructor(\1, private readonly cache: AppCacheService)',
            t,
            count=1,
        )

# after createCategory return - invalidate before return
if 'this.cache.invalidateCatalog' not in t:
    # after each prisma create/update/delete for categories and catalog-services
    for needle in [
        'return this.prisma.serviceCategory.create({\n',
        'return this.prisma.serviceCategory.update({\n',
        'return this.prisma.service.create({\n',
        'return this.prisma.service.update({\n',
    ]:
        if needle in t:
            t = t.replace(
                needle,
                'this.cache.invalidateCatalog();\n    return ' + needle[len('return '):],
                1,
            )
    # delete paths that return update
    t = t.replace(
        "await this.prisma.serviceCategory.update({\n      where: { id },\n      data: { isActive: false },",
        "this.cache.invalidateCatalog();\n    await this.prisma.serviceCategory.update({\n      where: { id },\n      data: { isActive: false },",
        1,
    )
    t = t.replace(
        "const updated = await this.prisma.service.update({\n      where: { id },\n      data: { isActive: false },",
        "this.cache.invalidateCatalog();\n    const updated = await this.prisma.service.update({\n      where: { id },\n      data: { isActive: false },",
        1,
    )

p.write_text(t, encoding='utf-8')
print('controller', 'AppCacheService' in t, 'invalidateCatalog' in t)

# --- admin catalog-template seed: reload after creates ---
p = Path('frontend/src/app/admin/catalog-template/page.tsx')
t = p.read_text(encoding='utf-8')
if 'await load()' in t and 'seedTemplate' in t:
    # rewrite seed to re-fetch categories list inside loop via api
    old = '''async function seedTemplate() {
    if (!window.confirm('قالب استاندارد تخصص‌ها و خانواده‌ها و خدمات در کاتالوگ ایجاد/تکمیل شود؟')) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      let created = 0;
      for (let i = 0; i < CATALOG_TEMPLATE.length; i++) {
        const sp = CATALOG_TEMPLATE[i];
        let root = categories.find((c) => c.slug === sp.slug || c.name === sp.name);
        if (!root) {
          root = await apiClient.post<Category>('/admin/service-categories', {
            name: sp.name,
            slug: sp.slug,
            sortOrder: i + 1,
          });
          created++;
        }
        for (let j = 0; j < sp.families.length; j++) {
          const fam = sp.families[j];
          const famSlug = `${sp.slug}-${j}-${fam.name}`.slice(0, 120);
          let famCat = categories.find(
            (c) => c.parentId === root!.id && c.name === fam.name,
          );
          if (!famCat) {
            famCat = await apiClient.post<Category>('/admin/service-categories', {
              name: fam.name,
              parentId: root.id,
              slug: famSlug,
              sortOrder: j + 1,
              description: fam.dims.length
                ? `DIMS:${fam.dims.map((d) => d.key + '=' + d.options.join('|')).join(';')}`
                : undefined,
            });
            created++;
          }
          for (let k = 0; k < fam.variants.length; k++) {
            const v = fam.variants[k];
            const exists = services.some(
              (s) => s.categoryId === famCat!.id && s.name === v.name,
            );
            if (!exists) {
              await apiClient.post('/admin/catalog-services', {
                name: v.name,
                categoryId: famCat.id,
                sortOrder: k + 1,
              }).catch(async () => {
                await apiClient.post('/admin/services', {
                  name: v.name,
                  categoryId: famCat!.id,
                }).catch(() => null);
              });
              created++;
            }
          }
        }
      }
      setMsg(`قالب اعمال شد (حدود ${created.toLocaleString('fa-IR')} مورد جدید).`);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }'''

    new = '''async function seedTemplate() {
    if (!window.confirm('قالب استاندارد تخصص‌ها و خانواده‌ها و خدمات در کاتالوگ ایجاد/تکمیل شود؟')) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      let created = 0;
      const refreshCats = async () => {
        const cats = await apiClient.get<Category[]>('/admin/service-categories');
        return Array.isArray(cats) ? cats : [];
      };
      const refreshSvcs = async () => {
        const svcs = await apiClient.get<Service[]>('/admin/catalog-services').catch(() => [] as Service[]);
        return Array.isArray(svcs) ? svcs : [];
      };
      let liveCats = await refreshCats();
      let liveSvcs = await refreshSvcs();
      for (let i = 0; i < CATALOG_TEMPLATE.length; i++) {
        const sp = CATALOG_TEMPLATE[i];
        let root = liveCats.find((c) => c.slug === sp.slug || c.name === sp.name);
        if (!root) {
          root = await apiClient.post<Category>('/admin/service-categories', {
            name: sp.name,
            slug: sp.slug,
            sortOrder: i + 1,
          });
          created++;
          liveCats = await refreshCats();
          root = liveCats.find((c) => c.slug === sp.slug || c.name === sp.name) || root;
        }
        for (let j = 0; j < sp.families.length; j++) {
          const fam = sp.families[j];
          const famSlug = `${sp.slug}-f${j}`;
          let famCat = liveCats.find((c) => c.parentId === root!.id && c.name === fam.name);
          if (!famCat) {
            famCat = await apiClient.post<Category>('/admin/service-categories', {
              name: fam.name,
              parentId: root!.id,
              slug: famSlug,
              sortOrder: j + 1,
              description: fam.dims.length
                ? `DIMS:${fam.dims.map((d) => d.key + '=' + d.options.join('|')).join(';')}`
                : undefined,
            });
            created++;
            liveCats = await refreshCats();
            famCat = liveCats.find((c) => c.parentId === root!.id && c.name === fam.name) || famCat;
          }
          for (let k = 0; k < fam.variants.length; k++) {
            const v = fam.variants[k];
            const exists = liveSvcs.some((s) => s.categoryId === famCat!.id && s.name === v.name);
            if (!exists) {
              await apiClient
                .post('/admin/catalog-services', {
                  name: v.name,
                  categoryId: famCat!.id,
                })
                .catch(async () => null);
              created++;
            }
          }
          liveSvcs = await refreshSvcs();
        }
      }
      setMsg(`قالب اعمال شد (حدود ${created.toLocaleString('fa-IR')} مورد جدید/بررسی‌شده). کاتالوگ را یک‌بار رفرش کنید.`);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(false);
    }
  }'''

    if 'const refreshCats' not in t:
        # try replace by function start to end of seedTemplate
        m = re.search(r'async function seedTemplate\(\) \{[\s\S]*?\n  \}\n\n  async function togglePopular', t)
        if m:
            t = t[: m.start()] + new + '\n\n  async function togglePopular' + t[m.end() :]
            p.write_text(t, encoding='utf-8')
            print('seed replaced')
        else:
            print('seed anchor miss')
    else:
        print('seed already hardened')

# fix collectRoots spacing on services page
p = Path('frontend/src/app/zibagar/services/page.tsx')
t = p.read_text(encoding='utf-8')
t2 = t.replace(
    'return tree.filter((c) => !c.parentId) .length ? tree.filter((c) => !c.parentId) : tree;',
    'const top = tree.filter((c) => !c.parentId);\n    return top.length ? top : tree;',
)
if t2 != t:
    p.write_text(t2, encoding='utf-8')
    print('collectRoots fixed')
