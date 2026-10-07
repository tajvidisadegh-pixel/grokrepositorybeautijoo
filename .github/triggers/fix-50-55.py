# -*- coding: utf-8 -*-
from pathlib import Path

p = Path('frontend/src/app/panel/settings/page.tsx')
t = p.read_text(encoding='utf-8')

CARD = '''      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">تغییر شماره موبایل</h2>
        <p className="text-xs text-gray">شماره فعلی: {user?.phone || '—'} — شماره جدید با کد تأیید می‌شود.</p>
        <input
          className="h-11 w-full rounded-2xl border border-border px-3 text-sm"
          placeholder="09xxxxxxxxx"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          dir="ltr"
        />
        {phoneStep === 'code' && (
          <input
            className="h-11 w-full rounded-2xl border border-border px-3 text-sm"
            placeholder="کد تأیید"
            value={phoneCode}
            onChange={(e) => setPhoneCode(e.target.value)}
            dir="ltr"
          />
        )}
        {phoneMsg && <p className="text-sm text-emerald-700">{phoneMsg}</p>}
        {phoneErr && <p className="text-sm text-red-600">{phoneErr}</p>}
        <div className="flex gap-2">
          {phoneStep === 'idle' ? (
            <Button size="sm" loading={phoneLoading} onClick={() => void onRequestPhoneChange()} disabled={newPhone.trim().length < 11}>
              ارسال کد
            </Button>
          ) : (
            <Button size="sm" loading={phoneLoading} onClick={() => void onVerifyPhoneChange()} disabled={phoneCode.trim().length < 4}>
              تأیید و تغییر
            </Button>
          )}
        </div>
      </Card>'''

# Find and remove broken region between "'خطا در" and "حذف حساب';"
marker_a = "'خطا در"
marker_b = "حذف حساب';"
a = t.find(marker_a)
b = t.find(marker_b, a if a >= 0 else 0)
print('markers', a, b)
if a >= 0 and b > a:
    t = t[:a] + "'خطا در حذف حساب';" + t[b + len(marker_b):]
    print('removed broken insert from catch')

# Remove any leftover duplicate cards that might still be in wrong places inside functions
# Count Card with phone change title
count = t.count('تغییر شماره موبایل')
print('phone title count', count)

# Ensure exactly one card in the return JSX, before danger zone
if 'منطقه خطر' in t:
    # remove all existing phone change cards first
    while 'تغییر شماره موبایل' in t:
        i = t.find('تغییر شماره موبایل')
        # find enclosing Card start
        cs = t.rfind('<Card', 0, i)
        ce = t.find('</Card>', i)
        if cs < 0 or ce < 0:
            break
        t = t[:cs] + t[ce + len('</Card>'):]
        print('removed a phone card at', cs)
    # insert clean card before danger zone card
    danger = t.find('منطقه خطر')
    cs = t.rfind('<Card', 0, danger)
    if cs > 0:
        t = t[:cs] + CARD + '\n\n      ' + t[cs:]
        print('inserted clean card before danger zone')
    else:
        t = t.replace('منطقه خطر', CARD + '\nمنطقه خطر', 1)
        print('fallback insert')
elif 'تغییر شماره موبایل' not in t:
    # insert before closing of main div
    idx = t.rfind('</div>')
    t = t[:idx] + CARD + '\n    ' + t[idx:]
    print('inserted at end')

p.write_text(t, encoding='utf-8')
print('done, titles', t.count('تغییر شماره موبایل'))
print('broken remnant', "'خطا در\n" in t or "'خطا در " in t and '<Card' in t[t.find("'خطا در"):t.find("'خطا در")+200] if "'خطا در" in t else False)
# show catch region
idx = t.find('onDeleteAccount')
print(t[t.find('catch', idx):t.find('catch', idx)+200] if idx>0 else 'no')
