from pathlib import Path

p = Path('backend/src/admin/admin-catalog.controller.ts')
t = p.read_text(encoding='utf-8')
if "catalog:categories" in t and 'cache' in t.lower():
    print('maybe already')
# inject AppCacheService if missing — simpler: clear via prisma path in services.service after admin writes is hard from controller
# Add invalidate in createCategory after create:

if "this.cache" not in t:
    # controller may not have cache; add note in services.service listCategories only
    pass

# services.service — expose invalidate and call from create paths used by pros; for admin use raw delete in controller via optional inject
sp = Path('backend/src/services/services.service.ts')
st = sp.read_text(encoding='utf-8')
if 'invalidateCatalogCache' not in st:
    st = st.replace(
        'async listCategories() {',
        "invalidateCatalogCache() {\n    this.cache.del?.('catalog:categories');\n    try { this.cache.delete?.('catalog:categories'); } catch { /* */ }\n    // AppCacheService uses .del or internal map\n    try { (this.cache as any).delete?.('catalog:categories'); } catch { /* */ }\n    try { (this.cache as any).invalidate?.('catalog:categories'); } catch { /* */ }\n  }\n\n  async listCategories() {",
        1,
    )
    # fix to actual API of AppCacheService
    sp.write_text(st, encoding='utf-8')
    print('added invalidate stub')

# read AppCacheService
ac = Path('backend/src/cache/app-cache.service.ts')
if ac.exists():
    print(ac.read_text(encoding='utf-8')[:800])
