#!/usr/bin/env python3
from pathlib import Path

p = Path('frontend/src/components/booking/booking-wizard.tsx')
t = p.read_text()

# After multiServiceTotals useMemo, redefine effective totals
if 'effectiveTotalDuration' not in t:
    needle = '''  const totalDuration = selected ? serviceDuration + selected.bufferMin : 30;
'''
    # Find after multiServiceTotals block ends - insert after totalDuration line
    if needle not in t:
        raise SystemExit('totalDuration line missing')
    t = t.replace(
        needle,
        '''  const singleTotalDuration = selected ? serviceDuration + selected.bufferMin : 30;
  const totalDuration = multiServiceTotals?.duration ?? singleTotalDuration;
  const effectiveDisplayPrice = multiServiceTotals?.price ?? displayPrice;
''',
        1,
    )

# Replace displayPrice with effectiveDisplayPrice in key UI spots (not definition)
# Be careful not to replace const displayPrice =
replacements = [
    ('formatPrice(displayPrice)', 'formatPrice(effectiveDisplayPrice)'),
    ('price: displayPrice,', 'price: effectiveDisplayPrice,'),
]
for a, b in replacements:
    t = t.replace(a, b)

# submitBooking: allow multi without requiring options from single selected
t = t.replace(
    'if (!selected || !date || !slotStart || !locationId) return;',
    'if ((!selected && selectedServices.length === 0) || !date || !slotStart || !locationId) return;',
)

# Ensure selectedServiceIds synced when single select from list focuses
if 'setSelectedServiceIds((prev)' not in t:
    print('WARN multi toggle missing')

p.write_text(t)
print('wired', p.stat().st_size)
# sanity
assert 'effectiveDisplayPrice' in t
assert 'multiServiceTotals?.duration' in t
