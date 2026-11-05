#!/usr/bin/env python3
"""Critical product fixes: zibagar pricing save for deposit/variable; clearer UX."""
from pathlib import Path
import re


def patch_zibagar_services() -> None:
    path = Path('frontend/src/app/zibagar/services/page.tsx')
    t = path.read_text()

    # Fix savePriceEdit: deposit/variable validation
    old = '''  async function savePriceEdit() {
    if (!sheet || sheet.kind !== 'price') return;
    const priceNum = Number(String(editPrice).replace(/[^\d]/g, ''));
    if (!Number.isFinite(priceNum) || priceNum < MIN_PRICE) {
      setError(`حداقل قیمت ${MIN_PRICE.toLocaleString('fa-IR')} تومان است`);
      return;
    }
    const dur = Math.max(5, Number(editDuration) || 60);
    setBusy(true);
    setError(null);
    try {
      const pricing = pricingPayload(editPricing);
      if (pricing.pricingMode === 'deposit' && !(pricing.depositAmount != null && pricing.depositAmount >= 0)) {
        setError('مبلغ بیعانه را وارد کنید');
        setBusy(false);
        return;
      }
      await patchMyService(sheet.ps.id, {
        price: priceNum,
        durationMin: dur,
        description: editDescription.trim() || undefined,
        isActive: true,
        ...pricing,
      });
'''
    new = '''  async function savePriceEdit() {
    if (!sheet || sheet.kind !== 'price') return;
    const pricing = pricingPayload(editPricing);
    const mode = String(pricing.pricingMode || 'fixed').toLowerCase();
    const priceNum = Number(String(editPrice).replace(/[^\d]/g, ''));

    // #80 — validation depends on mode (fixed needs base price; deposit needs depositAmount)
    if (mode === 'fixed') {
      if (!Number.isFinite(priceNum) || priceNum < MIN_PRICE) {
        setError(`حداقل قیمت ${MIN_PRICE.toLocaleString('fa-IR')} تومان است`);
        return;
      }
    } else if (mode === 'deposit') {
      if (!(pricing.depositAmount != null && pricing.depositAmount > 0)) {
        setError('مبلغ بیعانه را وارد کنید');
        return;
      }
      // base/list price optional; keep a sensible floor for display
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        setError('قیمت پایه نامعتبر است');
        return;
      }
    } else if (mode === 'variable') {
      // base price required so customer "from" price works
      if (!Number.isFinite(priceNum) || priceNum < MIN_PRICE) {
        setError(`برای قیمت با گزینه، قیمت پایه حداقل ${MIN_PRICE.toLocaleString('fa-IR')} تومان باشد`);
        return;
      }
    }

    const dur = Math.max(5, Number(editDuration) || 60);
    setBusy(true);
    setError(null);
    try {
      await patchMyService(sheet.ps.id, {
        price: Number.isFinite(priceNum) ? priceNum : 0,
        durationMin: dur,
        description: editDescription.trim() || undefined,
        isActive: true,
        ...pricing,
      });
'''
    if old not in t:
        print('WARN savePriceEdit pattern miss')
    else:
        t = t.replace(old, new, 1)
        print('savePriceEdit ok')

    # Fix save button disabled for deposit (allow when deposit filled)
    old_btn = '''            <Button
              className="h-14 w-full rounded-2xl text-base font-semibold"
              disabled={busy || !editPrice || Number(editPrice) < MIN_PRICE}
              onClick={() => void savePriceEdit()}
            >
'''
    new_btn = '''            <Button
              className="h-14 w-full rounded-2xl text-base font-semibold"
              disabled={busy}
              onClick={() => void savePriceEdit()}
            >
'''
    if old_btn in t:
        t = t.replace(old_btn, new_btn, 1)
        print('save button enabled')
    else:
        print('WARN save button pattern')

    # Price field label depends on mode - soft improve near edit price label
    if 'قیمت پایه / نمایشی' not in t:
        t = t.replace(
            '<label className="mb-1.5 block text-sm text-gray">قیمت (تومان)</label>',
            '<label className="mb-1.5 block text-sm text-gray">قیمت پایه (تومان)</label>',
            1,
        )

    path.write_text(t)
    print('zibagar services', path.stat().st_size)


def patch_pricing_mode_fields() -> None:
    path = Path('frontend/src/components/zibagar/PricingModeFields.tsx')
    t = path.read_text()
    # Ensure fixed-only still returns null (already)
    if "allowed.length === 1 && allowed[0] === 'fixed'" not in t:
        print('WARN fixed-only guard missing')
    # Better helper text under modes
    if 'فقط حالت‌هایی که ادمین برای این خدمت باز کرده' not in t and 'حالت قیمت‌گذاری' in t:
        t = t.replace(
            '<p className="text-sm font-medium text-[#0B2C4A]">حالت قیمت‌گذاری</p>',
            '<p className="text-sm font-medium text-[#0B2C4A]">حالت قیمت‌گذاری</p>\n'
            '      <p className="text-[11px] text-gray-500">فقط حالت‌هایی که برای این خدمت باز شده‌اند.</p>',
            1,
        )
        path.write_text(t)
        print('PricingModeFields hint')
    else:
        print('PricingModeFields ok')


def patch_admin_filter() -> None:
    path = Path('frontend/src/app/admin/service-categories/page.tsx')
    t = path.read_text()
    if 'pricingFilter' in t:
        print('admin filter already')
        return
    # Add simple filter state after query state
    if 'const [query, setQuery] = useState' not in t:
        print('WARN no query state')
        return
    t = t.replace(
        'const [query, setQuery] = useState(\'\');',
        "const [query, setQuery] = useState('');\n  const [pricingFilter, setPricingFilter] = useState<'all' | 'fixed' | 'variable' | 'deposit'>('all');",
        1,
    )
    # Filter filteredServices
    old_f = '''  const filteredServices = useMemo(() => {
    const q = query.trim();
    if (!q) return services;
    return services.filter(
'''
    # Find actual block - more flexible
    m = re.search(
        r'const filteredServices = useMemo\(\(\) => \{[^}]+return services\.filter',
        t,
        re.S,
    )
    if not m:
        # try simpler insert before return of useMemo
        print('WARN filteredServices - try alternate')
    # Insert UI near query input
    if 'placeholder="جستجو' in t or "placeholder='جستجو" in t or 'جستجو' in t:
        # add select after first search Input occurrence in services section - soft
        if 'setPricingFilter' not in t[t.find('filteredServices'):t.find('filteredServices')+800]:
            pass
    # Patch filter logic
    old_block = None
    for pat in [
        '''  const filteredServices = useMemo(() => {
    const q = query.trim();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.includes(q) ||
        (s.slug || '').includes(q) ||
        (s.category?.name || '').includes(q),
    );
  }, [services, query]);
''',
        '''  const filteredServices = useMemo(() => {
    const q = query.trim();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.includes(q) ||
        (s.category?.name || '').includes(q),
    );
  }, [services, query]);
''',
    ]:
        if pat in t:
            old_block = pat
            break
    if old_block:
        new_block = '''  const filteredServices = useMemo(() => {
    const q = query.trim();
    return services.filter((s) => {
      if (pricingFilter === 'variable' && !s.allowVariable) return false;
      if (pricingFilter === 'deposit' && !s.allowDeposit) return false;
      if (pricingFilter === 'fixed' && (s.allowVariable || s.allowDeposit)) return false;
      if (!q) return true;
      return (
        s.name.includes(q) ||
        (s.slug || '').includes(q) ||
        (s.category?.name || '').includes(q)
      );
    });
  }, [services, query, pricingFilter]);
'''
        t = t.replace(old_block, new_block, 1)
        print('filter logic ok')
    else:
        print('WARN could not patch filter logic')

    # Add filter select UI near query
    if 'pricingFilter' in t and 'setPricingFilter' in t:
        needle = '<Input\n            value={query}'
        if needle in t and 'فیلتر قیمت' not in t:
            t = t.replace(
                needle,
                '''<select
            value={pricingFilter}
            onChange={(e) => setPricingFilter(e.target.value as typeof pricingFilter)}
            className="h-10 rounded-xl border border-border bg-white px-3 text-sm"
            aria-label="فیلتر قیمت"
          >
            <option value="all">همه حالت‌های قیمت</option>
            <option value="fixed">فقط ثابت</option>
            <option value="variable">دارای متغیر</option>
            <option value="deposit">دارای بیعانه</option>
          </select>
          <Input
            value={query}''',
                1,
            )
            print('filter UI ok')

    path.write_text(t)
    print('admin cats', path.stat().st_size)


if __name__ == '__main__':
    patch_zibagar_services()
    patch_pricing_mode_fields()
    patch_admin_filter()
