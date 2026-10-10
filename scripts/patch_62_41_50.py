from pathlib import Path
import re

changed = []

# ---- 44: login expired banner ----
p = Path('frontend/src/app/login/page.tsx')
t = p.read_text(encoding='utf-8')
if 'expired' not in t or 'نشست شما منقضی' not in t:
    # ensure searchParams used
    if "useSearchParams" not in t:
        t = t.replace(
            "import { useRouter } from 'next/navigation';",
            "import { useRouter, useSearchParams } from 'next/navigation';",
            1,
        )
    if 'useSearchParams()' not in t:
        t = re.sub(
            r'(export default function \w+\([^)]*\) \{\n)',
            r'\1  const searchParams = useSearchParams();\n  const sessionExpired = searchParams.get("expired") === "1";\n',
            t,
            count=1,
        )
    elif 'sessionExpired' not in t:
        t = t.replace(
            'const searchParams = useSearchParams();',
            'const searchParams = useSearchParams();\n  const sessionExpired = searchParams.get("expired") === "1";',
            1,
        )
    if 'sessionExpired' in t and 'نشست شما منقضی شده' not in t:
        # insert banner near top of form/return
        if 'return (' in t:
            t = t.replace(
                'return (',
                'return (',
                1,
            )
            # after first <div or main in return
            m = re.search(r'return \(\s*\n\s*<div[^>]*>', t)
            if m:
                insert = m.group(0) + '\n      {sessionExpired && (\n        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">\n          نشست شما منقضی شده است. لطفاً دوباره وارد شوید.\n        </div>\n      )}'
                t = t[: m.start()] + insert + t[m.end() :]
                changed.append('44-banner')
            else:
                changed.append('44-place-miss')
        p.write_text(t, encoding='utf-8')
    else:
        p.write_text(t, encoding='utf-8')
        changed.append('44-partial')
else:
    changed.append('44-exists')

# ---- 42: delete account UX for OTP-only users ----
p = Path('frontend/src/app/panel/settings/page.tsx')
t = p.read_text(encoding='utf-8')
if 'اگر با OTP وارد شده‌اید' not in t:
    t = t.replace(
        'با حذف حساب، دسترسی شما قطع می‌شود و وضعیت حساب به «حذف‌شده» تغییر می‌کند. این عمل\n          قابل بازگشت نیست.',
        'با حذف حساب، دسترسی شما قطع می‌شود و وضعیت حساب به «حذف‌شده» تغییر می‌کند. این عمل\n'
        '          قابل بازگشت نیست. اگر حسابتان رمز عبور ندارد (ورود فقط با OTP)، حذف بدون رمز انجام می‌شود؛ در غیر این صورت وارد کردن رمز الزامی است.',
        1,
    )
    p.write_text(t, encoding='utf-8')
    changed.append('42-copy')

# ---- 47: show min lead time in booking wizard ----
p = Path('frontend/src/components/booking/booking-wizard.tsx')
t = p.read_text(encoding='utf-8')
if 'حداقل' not in t or 'ساعت قبل از نوبت' not in t:
    note = '''
          <p className="text-xs text-gray">
            رزرو باید حداقل چند ساعت قبل از نوبت ثبت شود (طبق قوانین پلتفرم). اگر زمان خیلی نزدیک باشد، سیستم اجازه رزرو نمی‌دهد.
          </p>'''
    if 'ادامه به خلاصه' in t and 'حداقل چند ساعت' not in t:
        t = t.replace(
            'ادامه به خلاصه',
            'ادامه به خلاصه',
            1,
        )
        # after datetime step button area
        t = t.replace(
            '<Button className="w-full" disabled={!slotStart} onClick={goSummary}>\n            ادامه به خلاصه\n          </Button>',
            note + '\n          <Button className="w-full" disabled={!slotStart} onClick={goSummary}>\n            ادامه به خلاصه\n          </Button>',
            1,
        )
        p.write_text(t, encoding='utf-8')
        changed.append('47-lead')
    else:
        changed.append('47-miss')
else:
    changed.append('47-ok')

# ---- 46: capacity hint on zibagar dashboard already; add public note on pro page ----
p = Path('frontend/src/app/professionals/[slug]/page.tsx')
t = p.read_text(encoding='utf-8')
if 'حداقل چند ساعت قبل' not in t and 'StickyBookBar' in t:
    t = t.replace(
        '<StickyBookBar slug={pro.slug} />',
        '<p className="mt-2 text-center text-xs text-gray-muted">رزرو آنلاین مشمول حداقل زمان از قبل و ظرفیت روز زیباگر است؛ اسلات‌های پر قابل انتخاب نیستند.</p>\n      <StickyBookBar slug={pro.slug} />',
        1,
    )
    p.write_text(t, encoding='utf-8')
    changed.append('46-hint')

# ---- 45: simple report link on pro profile ----
if 'گزارش تخلف' not in t:
    t = p.read_text(encoding='utf-8')
    if 'گزارش تخلف' not in t:
        support = "process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@beautijoo.ir'"
        t = t.replace(
            '<StickyBookBar slug={pro.slug} />',
            '<p className="mt-4 text-center text-xs text-gray-muted">\n'
            '        تخلف مشاهده کردید؟{' '}\n'
            '        <a\n'
            f"          href={{`mailto:${{{support}}}?subject=${{encodeURIComponent('گزارش تخلف پروفایل: ' + pro.slug)}}`}}\n"
            '          className="text-coral underline"\n'
            '        >\n'
            '          گزارش تخلف\n'
            '        </a>\n'
            '      </p>\n'
            '      <StickyBookBar slug={pro.slug} />',
            1,
        )
        # fix the f-string mess - rewrite carefully
        p.write_text(t, encoding='utf-8')
        changed.append('45-report-try')

# Fix 45 properly if broken
t = p.read_text(encoding='utf-8')
if 'گزارش تخلف پروفایل' in t and 'encodeURIComponent' in t:
    # check if syntax ok - if double braces wrong fix
    if 'href={{`mailto:' in t:
        t = t.replace(
            "href={{`mailto:${{process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@beautijoo.ir'}}?subject=${{encodeURIComponent('گزارش تخلف پروفایل: ' + pro.slug)}}`}}",
            "href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@beautijoo.ir'}?subject=${encodeURIComponent('گزارش تخلف پروفایل: ' + pro.slug)}`}",
            1,
        )
        p.write_text(t, encoding='utf-8')
        changed.append('45-fix')
elif 'گزارش تخلف' not in t:
    block = (
        "      <p className=\"mt-4 text-center text-xs text-gray-muted\">\n"
        "        تخلف مشاهده کردید؟{' '}\n"
        "        <a\n"
        "          href={`/complaint`}\n"
        "          className=\"text-coral underline\"\n"
        "        >\n"
        "          گزارش تخلف\n"
        "        </a>\n"
        "      </p>\n"
    )
    if '<StickyBookBar slug={pro.slug} />' in t:
        t = t.replace(
            '<StickyBookBar slug={pro.slug} />',
            block + '      <StickyBookBar slug={pro.slug} />',
            1,
        )
        p.write_text(t, encoding='utf-8')
        changed.append('45-complaint-link')

# ---- 49 + 50: admin ops metrics card ----
p = Path('frontend/src/app/admin/page.tsx')
t = p.read_text(encoding='utf-8')
if 'نرخ کنسلی' not in t:
    # add derived cancel rate near KPIs if overview available
    if 'overview.cancelledBookings' in t and 'نرخ کنسلی تقریبی' not in t:
        card = '''
      <Card className="space-y-2 p-4">
        <h2 className="font-semibold">شاخص‌های رشد / کیفیت</h2>
        <p className="text-sm text-gray">
          رزرو لغوشده: {fmt(overview.cancelledBookings)} · تکمیل‌شده از داده‌های داشبورد · برای مانیتورینگ فنی به{' '}
          <a href="/status" className="text-coral underline">/status</a> و متریک API مراجعه کنید.
        </p>
        <p className="text-xs text-gray">
          نرخ کنسلی تقریبی:{" "}
          {overview.totalBookings > 0
            ? `${Math.round((100 * (overview.cancelledBookings || 0)) / overview.totalBookings).toLocaleString('fa-IR')}٪`
            : '—'}
        </p>
      </Card>
'''
        # insert before fraud card or at end before closing
        if 'هشدار تقلب' in t:
            t = t.replace(
                '<Card className="space-y-2 p-4">\n        <h2 className="font-semibold">هشدار تقلب',
                card + '\n      <Card className="space-y-2 p-4">\n        <h2 className="font-semibold">هشدار تقلب',
                1,
            )
            p.write_text(t, encoding='utf-8')
            changed.append('50-kpi')
        else:
            idx = t.rfind('    </div>\n  );\n}')
            if idx > 0:
                t = t[:idx] + card + '\n' + t[idx:]
                p.write_text(t, encoding='utf-8')
                changed.append('50-kpi-end')
else:
    changed.append('50-exists')

# ---- 49: env note for monitoring ----
Path('docs').mkdir(exist_ok=True)
doc = Path('docs/issue-62-month2-ops.md')
if not doc.exists():
    doc.write_text(
        "# ایشو ۶۲ — ماه ۲ رشد و عملیات (۴۱–۵۰)\n\n"
        "- ۴۱: /terms /refund /faq /about /contact\n"
        "- ۴۲: حذف حساب در تنظیمات (رمز یا بدون رمز برای OTP-only)\n"
        "- ۴۳: تغییر موبایل با OTP شماره جدید\n"
        "- ۴۴: api forceLogin + login?expired=1\n"
        "- ۴۵: گزارش رزرو + /complaint برای پروفایل\n"
        "- ۴۶–۴۷: ظرفیت روز + BOOKING_MIN_LEAD_HOURS\n"
        "- ۴۸: فیلتر آینده/گذشته پنل مشتری\n"
        "- ۴۹: /health و /health/metrics + /status\n"
        "- ۵۰: KPI کنسلی در داشبورد ادمین\n",
        encoding='utf-8',
    )
    changed.append('docs')

# ensure BOOKING_MIN_LEAD in env example
for env_path in [Path('.env.example'), Path('backend/.env.example')]:
    if env_path.exists():
        et = env_path.read_text(encoding='utf-8')
        if 'BOOKING_MIN_LEAD_HOURS' not in et:
            et += '\n# Minimum hours before appointment for new bookings (#62.47)\nBOOKING_MIN_LEAD_HOURS=4\n'
            env_path.write_text(et, encoding='utf-8')
            changed.append(f'env-{env_path}')

print('CHANGED', changed)
