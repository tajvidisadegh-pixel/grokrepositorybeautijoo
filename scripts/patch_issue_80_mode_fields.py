#!/usr/bin/env python3
from pathlib import Path

# PricingModeFields: hide mode picker when only one allowed mode
p = Path('frontend/src/components/zibagar/PricingModeFields.tsx')
t = p.read_text()
old = '''export function PricingModeFields({ allowed, state, onChange, groups, disabled }: Props) {
  if (allowed.length === 1 && allowed[0] === 'fixed') {
    return null;
  }

  const activeGroups = (groups || []).filter((g) => g.isActive !== false);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-[#F7FBFF] p-3" dir="rtl">
      <p className="text-sm font-medium text-[#0B2C4A]">حالت قیمت‌گذاری</p>
      <div className="flex flex-wrap gap-2">
        {allowed.map((m) => (
'''
new = '''export function PricingModeFields({ allowed, state, onChange, groups, disabled }: Props) {
  // #80 pure fixed: no extra UI at all
  if (allowed.length === 1 && allowed[0] === 'fixed') {
    return null;
  }

  const activeGroups = (groups || []).filter((g) => g.isActive !== false);
  const showModePicker = allowed.length > 1;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-[#F7FBFF] p-3" dir="rtl">
      {showModePicker && (
        <>
          <p className="text-sm font-medium text-[#0B2C4A]">حالت قیمت‌گذاری</p>
          <div className="flex flex-wrap gap-2">
            {allowed.map((m) => (
'''
if old in t:
    t = t.replace(old, new, 1)
    # close the showModePicker fragment after the mode buttons div
    # Find the pattern after mode buttons closing
    close_old = '''        ))}
      </div>

      {state.mode === 'deposit' && (
'''
    close_new = '''        ))}
          </div>
        </>
      )}

      {state.mode === 'deposit' && (
'''
    if close_old in t:
        t = t.replace(close_old, close_new, 1)
        p.write_text(t)
        print('PricingModeFields ok')
    else:
        print('WARN close pattern')
        p.write_text(t)
else:
    print('WARN PricingModeFields pattern miss')

# Persian label in ServicePricingPanel
sp = Path('frontend/src/components/admin/ServicePricingPanel.tsx')
if sp.exists():
    st = sp.read_text()
    st2 = st.replace('>forcesDeposit<', '>بیعانه اجباری<')
    if st2 != st:
        sp.write_text(st2)
        print('forcesDeposit label fa')
