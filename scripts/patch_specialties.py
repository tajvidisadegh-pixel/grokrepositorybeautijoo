#!/usr/bin/env python3
from pathlib import Path

cp = Path("frontend/src/app/zibagar/profile/complete/page.tsx")
ct = cp.read_text()

old_ui = """          {!rootCategories.length ? (
            <p className="text-sm text-gray">در حال بارگذاری تخصص‌ها…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {featuredRootCategories.map((c) => {
                const on = selectedRootIds.includes(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => void toggleRootCategory(c.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-coral bg-coral text-white' : 'border-border bg-white'}`}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-[#0B2C4A]">{selectedRootIds.length} تخصص انتخاب شده</p>"""

new_ui = """          {!rootCategories.length ? (
            <p className="text-sm text-gray">هنوز تخصصی از پنل ادمین ثبت نشده است. از سوپرادمین دسته‌بندی/تخصص اضافه کنید.</p>
          ) : (
            <div className="space-y-3">
              <Input
                value={specialtySearch}
                onChange={(e) => setSpecialtySearch(e.target.value)}
                placeholder="جستجوی تخصص..."
                className="text-right"
              />
              <div className="flex flex-wrap gap-2">
                {(specialtySearch.trim()
                  ? rootCategories.filter((c) => c.name.includes(specialtySearch.trim()))
                  : rootCategories
                ).map((c) => {
                  const on = selectedRootIds.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => void toggleRootCategory(c.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-coral bg-coral text-white' : 'border-border bg-white'}`}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <p className="text-xs text-[#0B2C4A]">{selectedRootIds.length} تخصص انتخاب شده</p>"""

if old_ui in ct:
    ct = ct.replace(old_ui, new_ui)
    print("complete UI replaced")
elif "featuredRootCategories.map" in ct:
    ct = ct.replace("featuredRootCategories.map", "rootCategories.map")
    print("complete soft replace featured->all roots")
else:
    print("complete UI pattern miss")

old_load = """      fetchCategories()
        .then((cats) => {
          const roots = (cats || []).filter((c) => !c.parentId);
          setRootCategories(roots);"""
new_load = """      fetchCategories()
        .then((cats) => {
          const list = cats || [];
          const roots = list.filter((c) => !c.parentId);
          setRootCategories(roots.length ? roots : list);"""
if old_load in ct:
    ct = ct.replace(old_load, new_load)
    print("complete load fixed")
else:
    print("complete load pattern miss")

cp.write_text(ct)

svc = Path("frontend/src/app/zibagar/services/page.tsx")
st = svc.read_text()

old_add = """      {mode === 'add' && (
        <div className="space-y-3">
          <Input value={addSearch} onChange={(e) => setAddSearch(e.target.value)} placeholder="نام دسته..." className="w-full" />
          {addSearch.trim() && (
            <div className="relative">
              <ul className={`max-h-60 overflow-y-auto rounded-2xl border ${navy.border} bg-white p-1`}>
                {roots.filter((r) => r.name.includes(addSearch.trim())).slice(0, 10).map((r) => (
                  <li key={r.id}><button type="button" className="w-full rounded-xl px-3 py-2.5 text-right text-sm hover:bg-[#F3F6F9]" onClick={() => void addRootSpecialty(r.id)}>{r.name}</button></li>
                ))}
                {!roots.some((r) => r.name === addSearch.trim()) && (
                  <li>
                    <button type="button" disabled={busy} className={`w-full rounded-xl px-3 py-2.5 text-right text-sm font-semibold ${navy.title} hover:bg-[#F3F6F9]`} onClick={async () => { setBusy(true); try { const created = await createCategoryNode({ name: addSearch.trim() }); await addRootSpecialty(created.id); setAddSearch(''); } catch (e) { setError(friendlyApiError(e)); } finally { setBusy(false); } }}>＋ افزودن «{addSearch.trim()}»</button>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}"""

new_add = """      {mode === 'add' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">تخصص‌های تعریف‌شده توسط ادمین را انتخاب کنید.</p>
          <Input value={addSearch} onChange={(e) => setAddSearch(e.target.value)} placeholder="جستجوی تخصص..." className="w-full" />
          {!roots.length ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-gray-500">
              هنوز تخصصی از پنل سوپرادمین ثبت نشده است.
            </p>
          ) : (
            <ul className={`max-h-80 overflow-y-auto rounded-2xl border ${navy.border} bg-white p-1`}>
              {roots
                .filter((r) => !addSearch.trim() || r.name.includes(addSearch.trim()))
                .map((r) => {
                  const already = selectedRootIds.includes(r.id);
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        disabled={busy || already}
                        className={`w-full rounded-xl px-3 py-2.5 text-right text-sm hover:bg-[#F3F6F9] disabled:opacity-50 ${already ? 'text-[#2D6CDF]' : ''}`}
                        onClick={() => void addRootSpecialty(r.id)}
                      >
                        {r.name}{already ? ' · انتخاب‌شده' : ''}
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}"""

if old_add in st:
    st = st.replace(old_add, new_add)
    print("services add mode fixed")
elif 'placeholder="نام دسته..."' in st:
    st = st.replace('placeholder="نام دسته..."', 'placeholder="جستجوی تخصص..."')
    print("placeholder fixed")
else:
    print("services add pattern miss")

svc.write_text(st)

bs = Path("backend/src/services/services.service.ts")
bt = bs.read_text()
old_tree = """    const roots: CatRow[] = [];
    for (const c of byId.values()) {
      if (c.parentId && byId.has(c.parentId)) {
        byId.get(c.parentId)!.children.push(c);
      } else if (!c.parentId) {
        roots.push(c);
      }
    }"""
new_tree = """    const roots: CatRow[] = [];
    for (const c of byId.values()) {
      if (c.parentId && byId.has(c.parentId)) {
        byId.get(c.parentId)!.children.push(c);
      } else {
        roots.push(c);
      }
    }"""
if old_tree in bt:
    bt = bt.replace(old_tree, new_tree)
    bs.write_text(bt)
    print("backend orphans fixed")
else:
    print("backend tree pattern miss")

print("ALL DONE")
