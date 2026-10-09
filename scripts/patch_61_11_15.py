from pathlib import Path
import re

changed = []

# ---- 11: friendlier payment errors ----
p = Path('frontend/src/lib/api-errors.ts')
t = p.read_text(encoding='utf-8')
if 'پرداخت انجام نشد' not in t:
    t = t.replace(
        "{ test: /payment|درگاه|zarinpal|آیدی.?پی/i, fa: 'مشکل در پرداخت. دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.' },",
        "{ test: /payment|درگاه|zarinpal|آیدی.?پی|authority|verify/i, fa: 'پرداخت انجام نشد؛ ممکن است موجودی کافی نباشد یا درگاه موقتاً در دسترس نباشد. دوباره تلاش کنید.' },",
        1,
    )
    p.write_text(t, encoding='utf-8')
    changed.append('11-api-errors')

# payment callback richer error UI
p = Path('frontend/src/app/payment/callback/page.tsx')
t = p.read_text(encoding='utf-8')
if 'تلاش مجدد پرداخت' not in t:
    old = '''      {error ? (
        <>
          <p className="text-red-700">{error}</p>
          <Link href="/panel/bookings" className="mt-4 inline-block text-coral hover:underline">
            رزروهای من
          </Link>
        </>
      ) : (
        <p className="text-gray">{msg}</p>
      )}'''
    new = '''      {error ? (
        <div className="space-y-4 text-right" dir="rtl">
          <p className="text-lg font-bold text-red-700">پرداخت انجام نشد</p>
          <p className="text-sm text-red-800/90">{error}</p>
          <p className="text-xs text-gray">
            اگر مبلغ از حساب کسر شده، معمولاً تا ۷۲ ساعت برمی‌گردد. کد پیگیری درگاه را از پیامک بانک نگه دارید.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Link
              href="/panel/bookings"
              className="inline-flex h-11 items-center rounded-2xl bg-coral px-5 text-sm font-medium text-white"
            >
              رزروهای من / تلاش مجدد
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-2xl border border-border px-5 text-sm"
            >
              صفحه اصلی
            </Link>
          </div>
        </div>
      ) : (
        <p className="text-gray">{msg}</p>
      )}'''
    if old in t:
        t = t.replace(old, new, 1)
        p.write_text(t, encoding='utf-8')
        changed.append('11-callback')
    else:
        print('11-callback miss')

# ---- 12: confirmation pay status banner ----
conf = None
for cand in Path('frontend/src/app/booking/confirmation').rglob('page.tsx'):
    conf = cand
    break
if conf:
    t = conf.read_text(encoding='utf-8')
    if 'payStatusBanner' not in t and 'pay ===' not in t:
        # inject after booking is loaded - look for proName block
        if 'const canPay =' in t and 'payStatus' not in t:
            t = t.replace(
                'const canPay =',
                "const payQ = (searchParams.get('pay') || '').toLowerCase();\n"
                "  const payOk = payQ === 'paid' || payQ === 'success' || payQ === 'ok';\n"
                "  const payFail = payQ === 'failed' || payQ === 'cancelled' || payQ === 'canceled' || payQ === 'error';\n"
                "  const canPay =",
                1,
            )
        # UI banner before main card content
        if 'return (' in t and 'پرداخت با موفقیت' not in t:
            # find first Card usage after booking loaded
            m = re.search(r'(<Card[^>]*>)', t)
            if m and 'payOk' in t:
                banner = (
                    '{payOk && (\n'
                    '        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">\n'
                    '          <p className="font-bold">پرداخت با موفقیت ثبت شد</p>\n'
                    '          <p className="mt-1 text-xs">وضعیت رزرو را در همین صفحه یا از «رزروهای من» ببینید.</p>\n'
                    '        </div>\n'
                    '      )}\n'
                    '      {payFail && (\n'
                    '        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">\n'
                    '          <p className="font-bold">پرداخت کامل نشد</p>\n'
                    '          <p className="mt-1 text-xs">می‌توانید دوباره پرداخت کنید یا بعداً از رزروهای من اقدام کنید.</p>\n'
                    '        </div>\n'
                    '      )}\n        '
                )
                t = t[: m.start()] + banner + t[m.start() :]
                conf.write_text(t, encoding='utf-8')
                changed.append('12-confirm')
            else:
                print('12 banner place miss')
        else:
            print('12 skip or exists')
    else:
        changed.append('12-exists')
else:
    print('12 no conf')

# ---- 13: near-me privacy + city fallback ----
p = Path('frontend/src/components/search/near-me-fields.tsx')
t = p.read_text(encoding='utf-8')
if 'حریم خصوصی' not in t:
    # improve GPS deny message
    t = t.replace(
        "() => {\n        setStatus('برای «نزدیک من»، دسترسی موقعیت مکانی را در مرور",
        "() => {\n        setStatus('دسترسی موقعیت رد شد. می‌توانید شهر را دستی در فیلترها بنویسید. موقعیت روی دستگاه شما می‌ماند و بدون اجازه ذخیره نمی‌شود.');\n        setBusy(false);\n      },\n      // stub to keep parse — actual replaced below\n      () => {\n        setStatus('برای «نزدیک من»، دسترسی موقعیت مکانی را در مرور",
        1,
    )
    # That might double - do cleaner approach
    p.write_text(t, encoding='utf-8')

# rewrite near-me more carefully
t = p.read_text(encoding='utf-8')
if 'حریم خصوصی موقعیت' not in t:
    # append privacy line after status
    if '{status && <p className="text-xs text-gray">{status}</p>}' in t:
        t = t.replace(
            '{status && <p className="text-xs text-gray">{status}</p>}',
            '{status && <p className="text-xs text-gray">{status}</p>}\n'
            '      <p className="text-[11px] leading-5 text-gray">حریم خصوصی موقعیت: فقط برای مرتب‌سازی فاصله استفاده می‌شود. '
            'ذخیره فقط با تأیید شماست و هر زمان با «پاک» حذف می‌شود. اگر GPS در دسترس نیست، شهر را دستی انتخاب کنید.</p>',
            1,
        )
    # fix error callback to full message
    t2 = t
    # replace error callback body if still truncated pattern
    t2 = re.sub(
        r"setStatus\('برای «نزدیک من»، دسترسی موقعیت مکانی را در مرور[^']*'\);",
        "setStatus('دسترسی موقعیت رد شد یا در دسترس نیست. شهر را در فیلترها دستی وارد کنید.');",
        t2,
        count=1,
    )
    # remove accidental duplicate stub from earlier bad replace
    if 'stub to keep parse' in t2:
        t2 = re.sub(
            r"setBusy\(false\);\n      \},\n      // stub to keep parse — actual replaced below\n      \(\) => \{\n        setStatus\('برای «نزدیک من»، دسترسی موقعیت مکانی را در مرور",
            "setBusy(false);\n      },\n      () => {\n        setStatus('برای «نزدیک من»، دسترسی موقعیت مکانی را در مرور",
            t2,
            count=1,
        )
    p.write_text(t2, encoding='utf-8')
    changed.append('13-near')

# ---- 14: today / tomorrow toggles on search ----
p = Path('frontend/src/app/search/page.tsx')
t = p.read_text(encoding='utf-8')
if 'آزاد امروز' not in t:
    # ensure availableTomorrow support
    if 'availableTomorrow' not in t:
        t = t.replace(
            'availableToday?: string;',
            'availableToday?: string; availableTomorrow?: string;',
            1,
        )
        t = t.replace(
            "const availableToday = sp.availableToday === '1' || sp.availableToday === 'true';\n"
            "  const availableDate = availableToday ? tehranTodayIso() : (sp.availableDate?.trim() || undefined);",
            "const availableToday = sp.availableToday === '1' || sp.availableToday === 'true';\n"
            "  const availableTomorrow = sp.availableTomorrow === '1' || sp.availableTomorrow === 'true';\n"
            "  let availableDate = sp.availableDate?.trim() || undefined;\n"
            "  if (availableToday) availableDate = tehranTodayIso();\n"
            "  else if (availableTomorrow) {\n"
            "    const d = new Date(tehranTodayIso() + 'T12:00:00');\n"
            "    d.setDate(d.getDate() + 1);\n"
            "    availableDate = d.toISOString().slice(0, 10);\n"
            "  }",
            1,
        )
        # pageHref
        if "if (availableToday) params.set('availableToday', '1');" in t and 'availableTomorrow' not in t[t.find('pageHref'):t.find('pageHref')+800]:
            t = t.replace(
                "if (availableToday) params.set('availableToday', '1');",
                "if (availableToday) params.set('availableToday', '1');\n"
                "    if (availableTomorrow) params.set('availableTomorrow', '1');",
                1,
            )
    # UI chips near available date field
    needle = '<label className="mb-1 block text-xs font-medium text-gray">تاریخ در دسترس بودن</label>'
    if needle in t:
        chips = (
            '<div className="mb-2 flex flex-wrap gap-2">\n'
            '              <Link href={(() => { const p = new URLSearchParams(); if (q) p.set("q", q); if (city) p.set("city", city); if (category) p.set("category", category); p.set("availableToday", "1"); return `/search?${p.toString()}`; })()}\n'
            f'                className={{`rounded-full px-3 py-1.5 text-xs font-medium border ${{availableToday ? "border-coral bg-coral text-white" : "border-border bg-white text-foreground"}}`}}>آزاد امروز</Link>\n'
            '              <Link href={(() => { const p = new URLSearchParams(); if (q) p.set("q", q); if (city) p.set("city", city); if (category) p.set("category", category); p.set("availableTomorrow", "1"); return `/search?${p.toString()}`; })()}\n'
            f'                className={{`rounded-full px-3 py-1.5 text-xs font-medium border ${{availableTomorrow ? "border-coral bg-coral text-white" : "border-border bg-white text-foreground"}}`}}>آزاد فردا</Link>\n'
            '            </div>\n            '
        )
        # Fix f-string mess - write plain
        chips = (
            '<div className="mb-2 flex flex-wrap gap-2">\n'
            '              <Link\n'
            '                href={(() => {\n'
            '                  const p = new URLSearchParams();\n'
            '                  if (q) p.set("q", q);\n'
            '                  if (city) p.set("city", city);\n'
            '                  if (category) p.set("category", category);\n'
            '                  p.set("availableToday", "1");\n'
            '                  return `/search?${p.toString()}`;\n'
            '                })()}\n'
            '                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${availableToday ? "border-coral bg-coral text-white" : "border-border bg-white"}`}\n'
            '              >\n'
            '                آزاد امروز\n'
            '              </Link>\n'
            '              <Link\n'
            '                href={(() => {\n'
            '                  const p = new URLSearchParams();\n'
            '                  if (q) p.set("q", q);\n'
            '                  if (city) p.set("city", city);\n'
            '                  if (category) p.set("category", category);\n'
            '                  p.set("availableTomorrow", "1");\n'
            '                  return `/search?${p.toString()}`;\n'
            '                })()}\n'
            '                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${availableTomorrow ? "border-coral bg-coral text-white" : "border-border bg-white"}`}\n'
            '              >\n'
            '                آزاد فردا\n'
            '              </Link>\n'
            '            </div>\n            '
        )
        t = t.replace(needle, chips + needle, 1)
        p.write_text(t, encoding='utf-8')
        changed.append('14-toggles')
    else:
        print('14 needle miss')
else:
    changed.append('14-exists')

# ---- 15: alternative pros when no slots ----
p = Path('frontend/src/components/booking/booking-wizard.tsx')
t = p.read_text(encoding='utf-8')
if 'زیباگرهای مشابه' not in t:
    old = (
        '<p className="text-xs">تاریخ دیگری انتخاب کنید یا روز بعد را امتحان کنید.</p>\n'
        '                <button type="button" className="text-xs font-medium text-coral underline" onClick={() => {\n'
        '                  if (!date) return;\n'
        '                  const d = new Date(date + "T12:00:00");\n'
        '                  d.setDate(d.getDate() + 1);\n'
        '                  setDate(d.toISOString().slice(0, 10));\n'
        '                  setSlotStart("");\n'
        '                }}>امتحان روز بعد</button>'
    )
    new = (
        '<p className="text-xs">تاریخ دیگری انتخاب کنید یا روز بعد را امتحان کنید.</p>\n'
        '                <button type="button" className="text-xs font-medium text-coral underline" onClick={() => {\n'
        '                  if (!date) return;\n'
        '                  const d = new Date(date + "T12:00:00");\n'
        '                  d.setDate(d.getDate() + 1);\n'
        '                  setDate(d.toISOString().slice(0, 10));\n'
        '                  setSlotStart("");\n'
        '                }}>امتحان روز بعد</button>\n'
        '                <Link\n'
        '                  href={`/search?availableToday=1${selected?.name ? `&q=${encodeURIComponent(selected.name)}` : ""}`}\n'
        '                  className="mt-1 block text-xs font-medium text-blue underline"\n'
        '                >\n'
        '                  پیشنهاد زیباگرهای مشابه با نوبت آزاد\n'
        '                </Link>'
    )
    if old in t:
        t = t.replace(old, new, 1)
        p.write_text(t, encoding='utf-8')
        changed.append('15-alt')
    else:
        # softer insert
        if 'امتحان روز بعد</button>' in t and 'زیباگرهای مشابه' not in t:
            t = t.replace(
                'امتحان روز بعد</button>',
                'امتحان روز بعد</button>\n'
                '                <Link\n'
                '                  href={`/search?availableToday=1${selected?.name ? `&q=${encodeURIComponent(selected.name)}` : ""}`}\n'
                '                  className="mt-1 block text-xs font-medium text-blue underline"\n'
                '                >\n'
                '                  پیشنهاد زیباگرهای مشابه با نوبت آزاد\n'
                '                </Link>',
                1,
            )
            p.write_text(t, encoding='utf-8')
            changed.append('15-alt-soft')
        else:
            print('15 miss')

print('CHANGED', changed)
