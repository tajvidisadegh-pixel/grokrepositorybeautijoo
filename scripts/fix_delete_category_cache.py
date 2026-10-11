from pathlib import Path
p = Path('backend/src/admin/admin-catalog.controller.ts')
t = p.read_text(encoding='utf-8')
old = '''    const updated = this.cache.invalidateCatalog();
    await this.prisma.serviceCategory.update({
      where: { id },
      data: { isActive: false },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { services: true, children: true } },
      },
    });
    return { id, deleted: true, hard: false, isActive: updated.isActive };'''
new = '''    this.cache.invalidateCatalog();
    const updated = await this.prisma.serviceCategory.update({
      where: { id },
      data: { isActive: false },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { services: true, children: true } },
      },
    });
    return { id, deleted: true, hard: false, isActive: updated.isActive };'''
if old in t:
    t = t.replace(old, new)
    p.write_text(t, encoding='utf-8')
    print('fixed deleteCategory')
else:
    # broader fix
    t2 = t.replace(
        'const updated = this.cache.invalidateCatalog();\n    await this.prisma.serviceCategory.update(',
        'this.cache.invalidateCatalog();\n    const updated = await this.prisma.serviceCategory.update(',
    )
    if t2 != t:
        p.write_text(t2, encoding='utf-8')
        print('fixed alt')
    else:
        print('pattern miss')
        # show context
        i = t.find('deleteCategory')
        print(t[i:i+500])
