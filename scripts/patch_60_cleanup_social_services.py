from pathlib import Path
import re

# --- pro profile: strip social links block and share ---
p = Path('frontend/src/app/professionals/[slug]/page.tsx')
t = p.read_text(encoding='utf-8')

# remove ShareProfileButton usage
t = re.sub(
    r'\s*<div className="mt-2"><ShareProfileButton[^/]*/></div>',
    '',
    t,
)
t = re.sub(
    r'\s*<ShareProfileButton[^/]*/>',
    '',
    t,
)
# remove import if unused
if '<ShareProfileButton' not in t and 'ShareProfileButton' in t:
    t = re.sub(r"import \{ ShareProfileButton \} from '@/components/professionals/share-profile-button';\n", '', t)

# remove entire social links IIFE block (instagram/telegram/whatsapp)
if "label: 'اینستاگرام'" in t or "label: 'تلگرام'" in t:
    # replace the social block with nothing — find from {/* Issue #36 */} or socialLinks rendering
    pattern = r"\s*\{/* Issue #36 */}\s*\{\(\(\) => \{[\s\S]*?socialLinks[\s\S]*?\}\)\(\)\}"
    t2 = re.sub(pattern, '', t)
    if t2 == t:
        # broader: from const sl = socialLinks to closing of that IIFE before StickyBookBar or report
        pattern2 = r"\s*\{\(\(\) => \{\s*const sl = \(pro as \{ socialLinks[\s\S]*?if \(!items\.length\) return null;[\s\S]*?\}\)\(\)\}"
        t2 = re.sub(pattern2, '', t)
    t = t2

p.write_text(t, encoding='utf-8')
print('pro page cleaned', 'اینستاگرام' not in t, 'ShareProfileButton' not in t)

# --- zibagar layout: single menu entry ---
p = Path('frontend/src/app/zibagar/layout.tsx')
t = p.read_text(encoding='utf-8')
# remove separate menu link
t = t.replace(
    "  { href: '/zibagar/menu', label: 'منوی خدمات (جدید)' },\n",
    '',
)
t = t.replace(
    "{ href: '/zibagar/services', label: 'تخصص‌ها و منو قیمت' }",
    "{ href: '/zibagar/services', label: 'منوی خدمات', mobile: true }",
)
p.write_text(t, encoding='utf-8')
print('layout ok')

# --- redirect old /zibagar/menu to services ---
menu = Path('frontend/src/app/zibagar/menu/page.tsx')
menu.write_text(
    "'use client';\n\nimport { useEffect } from 'react';\nimport { useRouter } from 'next/navigation';\n\nexport default function ZibagarMenuRedirect() {\n  const router = useRouter();\n  useEffect(() => {\n    router.replace('/zibagar/services');\n  }, [router]);\n  return (\n    <p className=\"p-6 text-center text-sm text-gray\" dir=\"rtl\">\n      در حال انتقال به منوی خدمات…\n    </p>\n  );\n}\n",
    encoding='utf-8',
)
print('menu redirect')
