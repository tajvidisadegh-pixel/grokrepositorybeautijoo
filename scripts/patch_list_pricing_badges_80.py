#!/usr/bin/env python3
"""#80.9 — list badges: admin allow* + zibagar mode/price display."""
from pathlib import Path

def patch_admin() -> None:
    path = Path('frontend/src/app/admin/service-categories/page.tsx')
    t = path.read_text()
    if 'allowFixed' in t and 'متغیر' in t:
        print('admin already has badges')
        return

    old_type = """type Service = {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  categoryId?: string;
  category?: { id: string; name: string; slug: string } | null;
};"""
    new_type = """type Service = {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
  categoryId?: string;
  category?: { id: string; name: string; slug: string } | null;
  allowFixed?: boolean;
  allowVariable?: boolean;
  allowDeposit?: boolean;
  defaultPricingMode?: string;
};"""
    if old_type not in t:
        raise SystemExit('admin Service type missing')
    t = t.replace(old_type, new_type, 1)

    old_block = """                    <div>
                      <p className="text-sm font-medium">
                        {s.name}{' '}
                        {s.isActive === false && (
                          <span className="text-xs text-red-500">(غیرفعال)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {s.category?.name || 'بدون دسته'} · {s.slug}
                      </p>
                    </div>"""
    new_block = """                    <div>
                      <p className="text-sm font-medium">
                        {s.name}{' '}
                        {s.isActive === false && (
                          <span className="text-xs text-red-500">(غیرفعال)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {s.category?.name || 'بدون دسته'} · {s.slug}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(s.allowFixed !== false) && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">ثابت</span>
                        )}
                        {s.allowVariable && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">متغیر</span>
                        )}
                        {s.allowDeposit && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">بیعانه</span>
                        )}
                      </div>
                    </div>"""
    if old_block not in t:
        raise SystemExit('admin service row missing')
    t = t.replace(old_block, new_block, 1)
    path.write_text(t)
    print('admin patched', path.stat().st_size)


def patch_zibagar() -> None:
    path = Path('frontend/src/app/zibagar/services/page.tsx')
    t = path.read_text()

    old_dp = """function displayPrice(ps: ProfessionalServiceItem): number | null {
  const fromRules = (ps.priceRules || [])
    .filter((r) => r.price >= MIN_PRICE)
    .map((r) => r.price);
  if (fromRules.length) return Math.min(...fromRules);
  if ((ps.price ?? 0) >= MIN_PRICE) return ps.price;
  return null;
}"""
    new_dp = """function displayPrice(ps: ProfessionalServiceItem): number | null {
  const mode = String(ps.pricingMode || 'fixed').toLowerCase();
  if (mode === 'deposit') {
    if (ps.depositAmount != null && ps.depositAmount >= 0) return ps.depositAmount;
    return null;
  }
  if (mode === 'variable') {
    if (ps.estimateMinPrice != null && ps.estimateMinPrice >= MIN_PRICE) return ps.estimateMinPrice;
  }
  const fromRules = (ps.priceRules || [])
    .filter((r) => r.price >= MIN_PRICE)
    .map((r) => r.price);
  if (fromRules.length) return Math.min(...fromRules);
  if ((ps.price ?? 0) >= MIN_PRICE) return ps.price;
  return null;
}

function modeLabel(modeRaw?: string | null): string {
  const m = String(modeRaw || 'fixed').toLowerCase();
  if (m === 'variable') return 'گزینه‌ها';
  if (m === 'deposit') return 'بیعانه';
  return 'ثابت';
}"""
    if old_dp not in t:
        if 'function modeLabel' in t:
            print('zibagar displayPrice already patched')
        else:
            raise SystemExit('displayPrice missing')
    else:
        t = t.replace(old_dp, new_dp, 1)

    old_row = """                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy">{name}</p>
                    {cat && <p className="mt-0.5 text-xs text-gray">{cat}</p>}
                    <p className="mt-1.5 text-sm">
                      {from != null ? (
                        <span className="font-bold text-coral">{formatPrice(from)}</span>
                      ) : (
                        <span className="font-medium text-amber-600">قیمت بگذار</span>
                      )}
                      <span className="mr-2 text-xs text-gray">
                        · {ps.durationMin || 60} دقیقه
                      </span>
                    </p>
                  </div>"""
    new_row = """                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-semibold text-navy">{name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          String(ps.pricingMode || 'fixed').toLowerCase() === 'deposit'
                            ? 'bg-amber-50 text-amber-800'
                            : String(ps.pricingMode || 'fixed').toLowerCase() === 'variable'
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {modeLabel(ps.pricingMode)}
                      </span>
                    </div>
                    {cat && <p className="mt-0.5 text-xs text-gray">{cat}</p>}
                    <p className="mt-1.5 text-sm">
                      {from != null ? (
                        <span className="font-bold text-coral">
                          {String(ps.pricingMode || 'fixed').toLowerCase() === 'variable'
                            ? `از ${formatPrice(from)}`
                            : String(ps.pricingMode || 'fixed').toLowerCase() === 'deposit'
                              ? `بیعانه ${formatPrice(from)}`
                              : formatPrice(from)}
                        </span>
                      ) : (
                        <span className="font-medium text-amber-600">قیمت بگذار</span>
                      )}
                      <span className="mr-2 text-xs text-gray">
                        · {ps.durationMin || 60} دقیقه
                      </span>
                    </p>
                  </div>"""
    if old_row not in t:
        if 'modeLabel(ps.pricingMode)' in t:
            print('zibagar row already patched')
        else:
            raise SystemExit('zibagar row missing')
    else:
        t = t.replace(old_row, new_row, 1)
    path.write_text(t)
    print('zibagar patched', path.stat().st_size)


if __name__ == '__main__':
    patch_admin()
    patch_zibagar()
