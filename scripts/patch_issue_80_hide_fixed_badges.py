#!/usr/bin/env python3
"""#80 — hide mode badges when only fixed; zibagar list clean."""
from pathlib import Path


def patch_admin_list() -> None:
    path = Path('frontend/src/app/admin/service-categories/page.tsx')
    t = path.read_text()
    old = '''                      <div className="mt-1 flex flex-wrap gap-1">
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
'''
    new = '''                      <div className="mt-1 flex flex-wrap gap-1">
                        {/* #80: only show badges when non-fixed modes exist; pure fixed = no label clutter */}
                        {s.allowVariable && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">متغیر</span>
                        )}
                        {s.allowDeposit && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">بیعانه</span>
                        )}
                        {(s.allowVariable || s.allowDeposit) && (s.allowFixed !== false) && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">+ثابت</span>
                        )}
                      </div>
'''
    if old in t:
        path.write_text(t.replace(old, new, 1))
        print('admin badges ok')
    else:
        print('WARN admin badges pattern miss')


def patch_zibagar_list() -> None:
    path = Path('frontend/src/app/zibagar/services/page.tsx')
    t = path.read_text()
    # Hide mode badge when fixed-only
    if 'modeLabel(ps.pricingMode)' in t and 'hide fixed badge' not in t:
        # Replace badge rendering near modeLabel usage - more careful
        old = '''                        {modeLabel(ps.pricingMode)}
'''
        # Find context - only show when not fixed
        # Use a unique surrounding if possible
        t2 = t.replace(
            '{modeLabel(ps.pricingMode)}',
            "{String(ps.pricingMode || 'fixed').toLowerCase() !== 'fixed' ? modeLabel(ps.pricingMode) : null}",
            1,
        )
        if t2 != t:
            path.write_text(t2)
            print('zibagar badge hide fixed')
        else:
            print('WARN zibagar modeLabel not replaced')
    else:
        print('zibagar already patched or missing')


if __name__ == '__main__':
    patch_admin_list()
    patch_zibagar_list()
