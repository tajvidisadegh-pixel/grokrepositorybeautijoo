from pathlib import Path
p = Path('frontend/src/app/zibagar/services/page.tsx')
t = p.read_text(encoding='utf-8')
# Remove filteredFamilies after early return and place before if loading
old_block = '''  if (loading) return <PanelLoading label="بارگذاری منوی خدمات…" />;
  if (error && !tree.length && !CATALOG_TEMPLATE.length) {
    return <PanelError message={error} onRetry={load} />;
  }

  const filteredFamilies = useMemo(() => {
    if (!activeSpecialty) return [];
    const q = familySearch.trim();
    return activeSpecialty.families.filter((f) => {
      if (!q) return true;
      if (f.name.includes(q)) return true;
      return f.variants.some((v) => v.name.includes(q));
    });
  }, [activeSpecialty, familySearch]);
'''
new_block = '''  const filteredFamilies = useMemo(() => {
    if (!activeSpecialty) return [];
    const q = familySearch.trim();
    return activeSpecialty.families.filter((f) => {
      if (!q) return true;
      if (f.name.includes(q)) return true;
      return f.variants.some((v) => v.name.includes(q));
    });
  }, [activeSpecialty, familySearch]);

  if (loading) return <PanelLoading label="بارگذاری منوی خدمات…" />;
  if (error && !tree.length && !CATALOG_TEMPLATE.length) {
    return <PanelError message={error} onRetry={load} />;
  }
'''
if old_block in t:
    t = t.replace(old_block, new_block)
    p.write_text(t, encoding='utf-8')
    print('fixed hooks order')
else:
    print('block not found')
    i = t.find('if (loading)')
    print(repr(t[i:i+200]))
