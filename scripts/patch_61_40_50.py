from pathlib import Path
import re

changed = []

# ---- 41: transparent about page ----
p = Path('frontend/src/app/about/page.tsx')
t = p.read_text(encoding='utf-8')
if 'مدل درآمد' not in t:
    block = '''
        <h2 className="text-lg font-semibold text-[#0B2C4A]">مدل درآمد و مسئولیت</h2>
        <ul className="list-disc space-y-1 pr-5">
          <li>بیوتی‌جو واسط رزرو است؛ خدمت را زیباگر ارائه می‌دهد.</li>
          <li>کارمزد پلتفرم از مبلغ رزرو طبق تنظیمات مالی کسر می‌شود و در پنل زیباگر قابل مشاهده است.</li>
          <li>پرداخت آنلاین از درگاه معتبر انجام می‌شود؛ نتیجه در صفحه تأیید رزرو نمایش داده می‌شود.</li>
          <li>برای شکایت یا پیگیری به صفحه «ثبت شکایت» مراجعه کنید.</li>
        </ul>
'''
    if 'چه نمی‌کنیم؟' in t:
        t = t.replace(
            '<h2 className="text-lg font-semibold text-[#0B2C4A]">ارتباط با ما</h2>',
            block + '\n        <h2 className="text-lg font-semibold text-[#0B2C4A]">ارتباط با ما</h2>',
            1,
        )
        # link complaint
        if '/complaint' not in t:
            t = t.replace(
                'href="/contact"',
                'href="/contact"',
                1,
            )
            t = t.replace(
                '</div>\n    </div>\n  );\n}',
                '        <Link href="/complaint" className="text-[#2D6CDF] underline">\n'
                '          ثبت شکایت\n'
                '        </Link>\n'
                '      </div>\n    </div>\n  );\n}\n',
                1,
            )
        p.write_text(t, encoding='utf-8')
        changed.append('41-about')
else:
    changed.append('41-exists')

# ---- 42: complaint page ----
cp = Path('frontend/src/app/complaint/page.tsx')
if not cp.exists():
    cp.parent.mkdir(parents=True, exist_ok=True)
    cp.write_text('''import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, siteName } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'ثبت شکایت',
  description: `مسیر شکایت و پیگیری در ${siteName()}`,
  path: '/complaint',
});

export default function ComplaintPage() {
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@beautijoo.ir';
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0B2C4A]">ثبت شکایت و پیگیری</h1>
      <p className="text-sm text-gray-600">
        اگر از کیفیت خدمت، رزرو، پرداخت یا رفتار طرف مقابل ناراضی هستید، از این مسیر پیگیری کنید.
      </p>
      <ol className="list-decimal space-y-3 pr-5 text-sm leading-7 text-gray-800">
        <li>
          ابتدا از <Link href="/panel/bookings" className="text-coral underline">رزروهای من</Link>{' '}
          وضعیت نوبت و پرداخت را بررسی کنید.
        </li>
        <li>
          موضوع را با ذکر <strong>کد رزرو</strong>، تاریخ و شرح کوتاه به ایمیل پشتیبانی ارسال کنید:{' '}
          <a href={`mailto:${support}?subject=${encodeURIComponent('شکایت / پیگیری رزرو')}`} className="text-coral underline" dir="ltr">
            {support}
          </a>
        </li>
        <li>پاسخ اولیه معمولاً ظرف ۱ تا ۳ روز کاری ارسال می‌شود.</li>
        <li>
          برای قطع سرویس یا وضعیت سامانه: <Link href="/status" className="text-coral underline">/status</Link>
        </li>
      </ol>
      <div className="rounded-2xl border border-border bg-gray-light/40 px-4 py-3 text-xs text-gray">
        شکایت‌های مرتبط با ایمنی یا تخلف جدی در اولویت بررسی ادمین قرار می‌گیرند و در لاگ audit ثبت می‌شوند.
      </div>
      <Link href="/contact" className="inline-block text-sm text-blue underline">
        فرم تماس عمومی
      </Link>
    </div>
  );
}
''', encoding='utf-8')
    changed.append('42-complaint')

# ---- 43: skip link + a11y page ----
layout = Path('frontend/src/app/layout.tsx')
t = layout.read_text(encoding='utf-8')
if 'skip-to-content' not in t and 'رد شدن به محتوا' not in t:
    # add skip link after body open
    t2 = re.sub(
        r'(<body[^>]*>)',
        r'\1\n        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-coral focus:px-4 focus:py-2 focus:text-white">رد شدن به محتوا</a>',
        t,
        count=1,
    )
    if 'id="main-content"' not in t2:
        t2 = t2.replace('<main', '<main id="main-content"', 1)
        if '<main id="main-content"' not in t2:
            # children wrapper
            t2 = t2.replace('{children}', '<div id="main-content">{children}</div>', 1)
    layout.write_text(t2, encoding='utf-8')
    changed.append('43-skip')
else:
    changed.append('43-skip-exists')

ap = Path('frontend/src/app/accessibility/page.tsx')
if not ap.exists():
    ap.parent.mkdir(parents=True, exist_ok=True)
    ap.write_text('''import type { Metadata } from 'next';
import { pageMetadata, siteName } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'دسترس‌پذیری',
  description: `تعهد دسترس‌پذیری ${siteName()}`,
  path: '/accessibility',
});

export default function AccessibilityPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10" dir="rtl">
      <h1 className="text-2xl font-bold">دسترس‌پذیری</h1>
      <p className="text-sm leading-7 text-gray-800">
        تلاش می‌کنیم رزرو و پنل با صفحه‌کلید قابل استفاده باشد: لینک «رد شدن به محتوا»،
        برچسب دکمه‌ها، و کنتراست مناسب در تم روشن/تاریک. اگر مانعی دیدید از صفحه شکایت یا تماس اطلاع دهید.
      </p>
      <ul className="list-disc space-y-1 pr-5 text-sm text-gray-800">
        <li>ناوبری با Tab در فرم‌های ورود و رزرو</li>
        <li>پیام خطا به‌صورت متنی (نه فقط رنگ)</li>
        <li>پشتیبانی از prefers-color-scheme و دکمه تم</li>
      </ul>
    </div>
  );
}
''', encoding='utf-8')
    changed.append('43-page')

# ---- 44: ensure theme toggle in panel settings too ----
sp = Path('frontend/src/app/panel/settings/page.tsx')
t = sp.read_text(encoding='utf-8')
if 'ThemeToggle' not in t and 'حالت تاریک' not in t:
    if "'use client'" in t[:30]:
        t = t.replace(
            "'use client';\n",
            "'use client';\n\nimport { ThemeToggle } from '@/components/theme/theme-toggle';\n",
            1,
        )
    # insert a card after h1 area
    if 'مدیریت حساب' in t and 'حالت نمایش' not in t:
        t = t.replace(
            'مدیریت حساب، نشست‌ها و اعلان‌ها',
            'مدیریت حساب، نشست‌ها و اعلان‌ها',
            1,
        )
        # after first description p
        needle = '<p className="mt-1 text-sm text-gray">مدیریت حساب، نشست‌ها و اعلان‌ها</p>'
        if needle in t:
            t = t.replace(
                needle,
                needle
                + '''
      <div className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3">
        <div>
          <p className="text-sm font-medium">حالت نمایش</p>
          <p className="text-xs text-gray">روشن / تاریک</p>
        </div>
        <ThemeToggle />
      </div>''',
                1,
            )
            sp.write_text(t, encoding='utf-8')
            changed.append('44-theme-settings')
else:
    changed.append('44-theme-ok')

# ---- 45: minimal language note (fa default) ----
# html lang is usually in layout
t = layout.read_text(encoding='utf-8')
if 'lang="fa"' not in t and "lang='fa'" not in t:
    t = t.replace('<html', '<html lang="fa"', 1)
    layout.write_text(t, encoding='utf-8')
    changed.append('45-lang')
else:
    changed.append('45-lang-ok')
# tiny en stub for future
en = Path('frontend/src/app/en/about/page.tsx')
if not en.exists():
    en.parent.mkdir(parents=True, exist_ok=True)
    en.write_text('''import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'About (EN)', description: 'Beautijoo — beauty booking platform' };

/** Minimal English stub (#61.45). Full i18n later. */
export default function AboutEnPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10" dir="ltr">
      <h1 className="text-2xl font-bold">About Beautijoo</h1>
      <p className="text-sm text-gray-700">
        Beautijoo connects customers with beauty professionals for online booking. The primary UI is Persian (fa).
      </p>
      <Link href="/about" className="text-sm text-blue underline">
        نسخه فارسی
      </Link>
    </div>
  );
}
''', encoding='utf-8')
    changed.append('45-en')

# ---- 47: maintenance banner ----
banner = Path('frontend/src/components/layout/maintenance-banner.tsx')
if not banner.exists():
    banner.write_text('''\'use client';

/** Shows planned outage notice when NEXT_PUBLIC_MAINTENANCE_MESSAGE is set. */
export function MaintenanceBanner() {
  const msg = process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE?.trim();
  if (!msg) return null;
  return (
    <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950" role="status">
      {msg}
    </div>
  );
}
'''.replace("\\'", "'"), encoding='utf-8')
    # fix the escape - write cleanly
    banner.write_text(
        "'use client';\n\n"
        "/** Shows planned outage notice when NEXT_PUBLIC_MAINTENANCE_MESSAGE is set. */\n"
        "export function MaintenanceBanner() {\n"
        "  const msg = process.env.NEXT_PUBLIC_MAINTENANCE_MESSAGE?.trim();\n"
        "  if (!msg) return null;\n"
        "  return (\n"
        "    <div className=\"bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950\" role=\"status\">\n"
        "      {msg}\n"
        "    </div>\n"
        "  );\n"
        "}\n",
        encoding='utf-8',
    )
    changed.append('47-banner-comp')

# wire banner in layout
t = layout.read_text(encoding='utf-8')
if 'MaintenanceBanner' not in t:
    if "from '@/components/" in t:
        t = t.replace(
            "'use client';\n",
            "'use client';\n",
            1,
        )
    # layout may be server component
    if 'MaintenanceBanner' not in t:
        # add import after first import
        lines = t.splitlines()
        insert_at = 0
        for i, line in enumerate(lines):
            if line.startswith('import '):
                insert_at = i + 1
        lines.insert(insert_at, "import { MaintenanceBanner } from '@/components/layout/maintenance-banner';")
        t = '\n'.join(lines) + ('\n' if t.endswith('\n') else '')
        t = re.sub(
            r'(<body[^>]*>)',
            r'\1\n        <MaintenanceBanner />',
            t,
            count=1,
        )
        layout.write_text(t, encoding='utf-8')
        changed.append('47-banner-layout')

# ---- 48: strengthen delete account copy if weak ----
t = sp.read_text(encoding='utf-8')
if 'حق فراموشی' not in t and 'deleteAccount' in t:
    t = t.replace(
        'حذف حساب',
        'حذف حساب',
        1,
    )
    if 'حذف دائمی' not in t:
        # find delete section heading
        t = t.replace(
            '<h2 className="text-lg font-semibold">حذف حساب</h2>',
            '<h2 className="text-lg font-semibold">حذف حساب (حق فراموشی)</h2>\n'
            '        <p className="text-xs text-gray">با حذف حساب، داده‌های شخصی طبق سیاست حریم خصوصی حذف یا ناشناس می‌شوند. رزروهای مالی ممکن است برای الزامات قانونی نگه‌داری شوند.</p>',
            1,
        )
        sp.write_text(t, encoding='utf-8')
        changed.append('48-delete-copy')
else:
    changed.append('48-ok')

# ---- 49: sessions already - add note ----
t = sp.read_text(encoding='utf-8')
if 'نشست‌های فعال' in t and 'دستگاه‌های دیگر' not in t:
    t = t.replace(
        '<h2 className="text-lg font-semibold">نشست‌های فعال</h2>',
        '<h2 className="text-lg font-semibold">نشست‌های فعال</h2>\n'
        '          <p className="text-xs text-gray">اگر دستگاهی را نمی‌شناسید، همان را لغو کنید یا «لغو همه نشست‌ها» را بزنید.</p>',
        1,
    )
    sp.write_text(t, encoding='utf-8')
    changed.append('49-session-note')

# ---- 40: ensure checklist exists (admin settings) ----
adm = Path('frontend/src/app/admin/settings/page.tsx')
if adm.exists():
    t = adm.read_text(encoding='utf-8')
    if 'چک‌لیست انتشار' not in t:
        changed.append('40-missing')
    else:
        changed.append('40-ok')

# ---- 50: product owner summary ----
Path('docs').mkdir(exist_ok=True)
po = Path('docs/product-owner-summary-61.md')
if not po.exists():
    po.write_text(
        "# جمع‌بندی مالک محصول — ایشو #61\n\n"
        "## اعتماد مشتری\n"
        "- پرداخت و بازگشت از درگاه با پیام واضح\n"
        "- جستجوی نزدیک من + آزاد امروز/فردا\n"
        "- شکایت: /complaint\n\n"
        "## عملیات زیباگر\n"
        "- داشبورد روزانه، تأیید موبایلی، مرخصی چندروزه، سقف ظرفیت\n\n"
        "## ریسک و کیفیت\n"
        "- صف SLA زیباگر، audit، تعلیق با دلیل، /status جدا برای پرداخت/پیامک\n"
        "- چک‌لیست انتشار در تنظیمات ادمین\n\n"
        "## اعتماد بلندمدت\n"
        "- درباره شفاف، دسترس‌پذیری، تم تاریک، نشست‌ها، حذف حساب\n"
        "- بنر قطع سرویس با NEXT_PUBLIC_MAINTENANCE_MESSAGE\n",
        encoding='utf-8',
    )
    changed.append('50-docs')

# Footer links for complaint + accessibility
fp = Path('frontend/src/components/layout/footer.tsx')
t = fp.read_text(encoding='utf-8')
if '/complaint' not in t:
    t = t.replace(
        '<Link href="/contact" className="transition-colors hover:text-coral-light">\n                تماس با پشتیبانی\n              </Link>',
        '<Link href="/contact" className="transition-colors hover:text-coral-light">\n                تماس با پشتیبانی\n              </Link>\n            </li>\n            <li>\n              <Link href="/complaint" className="transition-colors hover:text-coral-light">\n                ثبت شکایت\n              </Link>\n            </li>\n            <li>\n              <Link href="/accessibility" className="transition-colors hover:text-coral-light">\n                دسترس‌پذیری\n              </Link>',
        1,
    )
    # may have broken li - check
    fp.write_text(t, encoding='utf-8')
    changed.append('footer-links')

print('CHANGED', changed)
