#!/usr/bin/env python3
from pathlib import Path

p = Path('frontend/src/app/zibagar/earnings/page.tsx')
t = p.read_text()

# Labels: remove net/gross wording for professional UI
t = t.replace('کل درآمد خالص', 'کل درآمد')
t = t.replace(
    '<p className="text-xs text-gray">ناخالص {formatPrice(p.amount)}</p>',
    '<p className="text-xs text-gray">درآمد</p>',
)

# Remove commission from net calculation display path — still use professionalNetAmount only
t = t.replace(
    'const net = p.professionalNetAmount ?? Math.max(0, p.amount - (p.platformCommissionAmount || 0));',
    'const net = p.professionalNetAmount != null && p.professionalNetAmount >= 0 ? p.professionalNetAmount : p.amount;',
)

# Title of list
t = t.replace('تراکنش‌های رزرو (پرداخت مشتری)', 'تراکنش‌های درآمد')

# Enhance periods block with simple bar chart if not already present
if 'maxEarned' not in t and '{periods && (' in t:
    old = '''      {periods && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-gray">امروز</p>
            <p className="mt-1 font-bold">{formatPrice(periods.today?.earned ?? 0)}</p>
            <p className="text-xs text-gray">{periods.today?.count ?? 0} نوبت</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray">این هفته</p>
            <p className="mt-1 font-bold">{formatPrice(periods.week?.earned ?? 0)}</p>
            <p className="text-xs text-gray">{periods.week?.count ?? 0} نوبت</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray">این ماه</p>
            <p className="mt-1 font-bold">{formatPrice(periods.month?.earned ?? 0)}</p>
            <p className="text-xs text-gray">{periods.month?.count ?? 0} نوبت</p>
          </Card>
        </div>
      )}'''
    new = '''      {periods && (() => {
        const bars = [
          { key: 'today', label: 'امروز', earned: periods.today?.earned ?? 0, count: periods.today?.count ?? 0 },
          { key: 'week', label: 'این هفته', earned: periods.week?.earned ?? 0, count: periods.week?.count ?? 0 },
          { key: 'month', label: 'این ماه', earned: periods.month?.earned ?? 0, count: periods.month?.count ?? 0 },
          { key: 'allTime', label: 'کل دوره', earned: periods.allTime?.earned ?? 0, count: periods.allTime?.count ?? 0 },
        ];
        const maxEarned = Math.max(1, ...bars.map((b) => b.earned));
        return (
          <Card className="space-y-4 p-4">
            <h2 className="font-semibold">درآمد بر اساس بازه زمانی</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {bars.map((b) => (
                <div key={b.key} className="rounded-xl border border-border/80 bg-gray-light/20 p-3">
                  <p className="text-xs text-gray">{b.label}</p>
                  <p className="mt-1 font-bold">{formatPrice(b.earned)}</p>
                  <p className="text-xs text-gray">{b.count} نوبت</p>
                </div>
              ))}
            </div>
            <div className="space-y-2" dir="ltr">
              {bars.map((b) => {
                const pct = Math.round((b.earned / maxEarned) * 100);
                return (
                  <div key={`bar-${b.key}`} className="space-y-1">
                    <div className="flex justify-between text-xs text-gray" dir="rtl">
                      <span>{b.label}</span>
                      <span className="font-medium text-foreground">{formatPrice(b.earned)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-gray-light">
                      <div className="h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}'''
    if old in t:
        t = t.replace(old, new, 1)
    else:
        print('WARN periods block pattern not found')

# Drop unused type fields that advertise commission in frontend types (optional cleanup)
t = t.replace('  grossRevenue: number;\n  platformCommission: number;\n', '')
t = t.replace('type PeriodBlock = { earned: number; gross: number; count: number };', 'type PeriodBlock = { earned: number; count: number };')
t = t.replace('  platformCommissionAmount?: number | null;\n', '')

p.write_text(t)
assert 'ناخالص' not in t
assert 'platformCommission' not in t
assert 'کل درآمد خالص' not in t
print('issue23 earnings UI patched', len(t))
