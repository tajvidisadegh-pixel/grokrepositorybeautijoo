from pathlib import Path
import re

changed = []

# ---- 8: unavailable slots red & unselectable ----
p = Path('frontend/src/components/booking/booking-wizard.tsx')
t = p.read_text(encoding='utf-8')
old_slot = """className={`rounded-xl border px-3 py-2 text-sm ${
                        on
                          ? 'border-coral bg-coral text-white'
                          : available
                            ? 'border-border bg-white hover:border-coral'
                            : 'cursor-not-allowed border-border bg-gray-light text-gray-muted'
                      }`}"""
new_slot = """className={`rounded-xl border px-3 py-2 text-sm ${
                        on
                          ? 'border-coral bg-coral text-white'
                          : available
                            ? 'border-border bg-white hover:border-coral'
                            : 'cursor-not-allowed border-red-300 bg-red-50 text-red-700 line-through opacity-80'
                      }`}"""
if old_slot in t:
    t = t.replace(old_slot, new_slot, 1)
    p.write_text(t, encoding='utf-8')
    changed.append('8-red-slots')
elif 'border-red-300 bg-red-50' in t:
    changed.append('8-exists')
else:
    # softer replace
    t2 = t.replace(
        "'cursor-not-allowed border-border bg-gray-light text-gray-muted'",
        "'cursor-not-allowed border-red-300 bg-red-50 text-red-700 line-through opacity-80'",
        1,
    )
    if t2 != t:
        p.write_text(t2, encoding='utf-8')
        changed.append('8-red-soft')
    else:
        changed.append('8-miss')

# ---- 2: payment callback clearer success/fail ----
p = Path('frontend/src/app/payment/callback/page.tsx')
t = p.read_text(encoding='utf-8')
if 'بازگشت به رزروها' not in t:
    # enhance error block
    old = """{error ? (
        <div className="space-y-4">
          <p className="text-red-600">{error}</p>
          <Link href="/panel/bookings" className="text-coral underline">
            مشاهده رزروها
          </Link>
        </div>
      )"""
    # try broader match
    if 'text-red-600' in t and 'مشاهده رزروها' not in t:
        t = t.replace(
            '{error ? (',
            '{error ? (',
            1,
        )
        # replace error rendering section more carefully
        m = re.search(r'\{error \? \([\s\S]*?\) : \(', t)
        if m:
            replacement = """{error ? (
        <div className="space-y-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-6">
          <p className="text-lg font-semibold text-red-800">پرداخت ناموفق یا تأیید نشد</p>
          <p className="text-sm text-red-700">{error}</p>
          <p className="text-xs text-gray">اگر مبلغ از حساب کسر شده، تا چند دقیقه دیگر وضعیت رزرو را در پنل بررسی کنید یا با پشتیبانی تماس بگیرید.</p>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <Link href="/panel/bookings" className="rounded-xl bg-coral px-4 py-2 text-white">بازگشت به رزروها</Link>
            <Link href="/contact" className="rounded-xl border border-border bg-white px-4 py-2">تماس پشتیبانی</Link>
          </div>
        </div>
      ) : ("""
            t = t[: m.start()] + replacement + t[m.end() :]
            p.write_text(t, encoding='utf-8')
            changed.append('2-pay-ui')
        else:
            changed.append('2-pay-miss')
    else:
        changed.append('2-pay-partial')
else:
    changed.append('2-exists')

# ---- 7: strengthen conflict message map ----
p = Path('frontend/src/lib/api-errors.ts')
t = p.read_text(encoding='utf-8')
if 'این زمان قبلاً رزرو شده' not in t or 'حداکثر' not in t:
    insert = """  { test: /قبلاً رزرو|این بازه زمانی قبلاً|already booked|slot.*taken/i, fa: 'این زمان قبلاً رزرو شده است. زمان دیگری انتخاب کنید.' },
  { test: /حداکثر .* رزرو فعال|concurrent|رزرو فعال همزمان/i, fa: 'تعداد رزروهای فعال شما به سقف مجاز رسیده است. ابتدا یکی را مدیریت کنید.' },
"""
    if 'MESSAGE_MAP' in t and 'حداکثر .* رزرو فعال' not in t:
        t = t.replace(
            'const MESSAGE_MAP: Array<{ test: RegExp; fa: string }> = [',
            'const MESSAGE_MAP: Array<{ test: RegExp; fa: string }> = [\n' + insert,
            1,
        )
        p.write_text(t, encoding='utf-8')
        changed.append('7-err-map')
    else:
        changed.append('7-map-ok')
else:
    changed.append('7-ok')

# ---- 1 + env: production payment notes ----
for env_path in [Path('.env.example'), Path('backend/.env.example')]:
    if not env_path.exists():
        continue
    t = env_path.read_text(encoding='utf-8')
    if 'MAX_CONCURRENT_BOOKINGS' not in t:
        t += '\n# Max active bookings per customer (#62.6)\nMAX_CONCURRENT_BOOKINGS=3\n'
        env_path.write_text(t, encoding='utf-8')
        changed.append(f'env-max-{env_path}')
    if 'Production payment' not in t and 'PAYMENT_PROVIDER=zarinpal' not in t:
        note = (
            '\n# Production payment (#62.1): set PAYMENT_PROVIDER=zarinpal, '
            'ZARINPAL_MERCHANT_ID, ZARINPAL_SANDBOX=false, and callback URL on gateway dashboard\n'
        )
        if 'ZARINPAL_MERCHANT_ID' in t:
            t = t.replace(
                '# ZARINPAL_MERCHANT_ID=',
                note + '# ZARINPAL_MERCHANT_ID=',
                1,
            )
            env_path.write_text(t, encoding='utf-8')
            changed.append(f'env-pay-{env_path}')

Path('docs').mkdir(exist_ok=True)
doc = Path('docs/issue-62-week1-payment.md')
if not doc.exists():
    doc.write_text(
        "# ایشو ۶۲ — هفته ۱ اعتماد و پول (موارد ۱–۱۰)\n\n"
        "## ۱. درگاه واقعی\n"
        "- `PAYMENT_PROVIDER=zarinpal`\n"
        "- `ZARINPAL_MERCHANT_ID` + `ZARINPAL_SANDBOX=false` روی production\n"
        "- Callback: `{APP_URL}/payment/callback` در پنل زرین‌پال\n\n"
        "## ۲–۴. UX پرداخت و کنسلی\n"
        "- `/payment/callback` → confirmation با وضعیت\n"
        "- خلاصه رزرو: خدمت + افزودنی + جمع\n"
        "- `CancelPolicyNotice` قبل از پرداخت\n\n"
        "## ۵–۸. رزرو\n"
        "- no-show در پنل زیباگر\n"
        "- `MAX_CONCURRENT_BOOKINGS` (پیش‌فرض ۳)\n"
        "- ConflictException فارسی برای اسلات تکراری\n"
        "- اسلات غیرفعال قرمز و disabled\n\n"
        "## ۹–۱۰. یادآوری و E2E\n"
        "- `RemindersService` ۲۴س و ۲س\n"
        "- `backend/test/bookings/lifecycle.e2e-spec.ts`\n",
        encoding='utf-8',
    )
    changed.append('1-docs')

# ---- 15: ensure rating number on card (already ★ N) - add aria ----
p = Path('frontend/src/components/professionals/professional-card.tsx')
t = p.read_text(encoding='utf-8')
if 'aria-label' not in t and '★' in t:
    t = t.replace(
        '<span className="text-amber-500">\n                ★ {rating}',
        '<span className="text-amber-500" aria-label={`امتیاز ${rating} از ۵`}>\n                ★ {rating}',
        1,
    )
    p.write_text(t, encoding='utf-8')
    changed.append('15-aria')

# ---- 18: search loading skeleton if plain text ----
p = Path('frontend/src/app/search/page.tsx')
t = p.read_text(encoding='utf-8')
if 'GridSkeleton' not in t and 'loading' in t.lower():
    # import and use if simple loading
    if "from '@/components/panel/state-blocks'" not in t:
        t = "import { GridSkeleton, PanelEmpty } from '@/components/panel/state-blocks';\n" + t
    if 'در حال بارگذاری' in t and 'GridSkeleton' not in t:
        t = t.replace(
            'در حال بارگذاری',
            'در حال بارگذاری',
            1,
        )
        # optional - only if obvious loading block
        changed.append('18-partial')
    p.write_text(t, encoding='utf-8') if 'GridSkeleton' in t else None

# ---- 19: remove leftover dev-facing copy ----
for rel in [
    'frontend/src/components/booking/booking-wizard.tsx',
    'frontend/src/app/search/page.tsx',
    'frontend/src/app/booking/[slug]/page.tsx',
]:
    fp = Path(rel)
    if not fp.exists():
        continue
    t = fp.read_text(encoding='utf-8')
    t2 = t
    for phrase in [
        'زمان‌ها فقط از سرور',
        'times only from server',
        'DEBUG',
        'TODO: remove',
    ]:
        if phrase in t2:
            t2 = t2.replace(phrase, '')
    if t2 != t:
        fp.write_text(t2, encoding='utf-8')
        changed.append(f'19-{rel}')

# ---- 12: near-me already one click; ensure search has quick link ----
p = Path('frontend/src/app/search/page.tsx')
t = p.read_text(encoding='utf-8')
if 'نزدیک من' not in t and 'HomeNearMeButton' not in t:
    if "'use client'" in t[:40] or 'use client' in t[:40]:
        pass
    # add note under title if missing
    if 'فیلتر بر اساس' in t and 'نزدیک من' not in t:
        t = t.replace(
            'فیلتر بر اساس متن، شهر، فاصله، دسته، امتیاز، قیمت و تاریخ در دسترس بودن',
            'فیلتر بر اساس متن، شهر، فاصله، دسته، امتیاز، قیمت و تاریخ در دسترس بودن. برای نزدیک‌ترین‌ها از دکمه «نزدیک من» در صفحه اصلی استفاده کنید.',
            1,
        )
        p.write_text(t, encoding='utf-8')
        changed.append('12-hint')
else:
    changed.append('12-ok')

# ---- 10: e2e note in lifecycle header if missing ----
p = Path('backend/test/bookings/lifecycle.e2e-spec.ts')
if p.exists():
    t = p.read_text(encoding='utf-8')
    if '#62.10' not in t:
        t = '/** #62.10 — full booking lifecycle coverage (create → pay path → complete → review). */\n' + t
        p.write_text(t, encoding='utf-8')
        changed.append('10-e2e-note')

print('CHANGED', changed)
