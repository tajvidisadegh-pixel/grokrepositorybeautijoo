#!/usr/bin/env python3
"""Remaining #83: report button on pro page, search harden, admin support filter."""
from pathlib import Path
import sys

# --- 1) professionals/[slug]/page.tsx: replace mailto with ReportProfileButton ---
slug = Path('frontend/src/app/professionals/[slug]/page.tsx')
if slug.is_file():
    t = slug.read_text()
    if 'ReportProfileButton' not in t:
        # add import near other component imports
        if "from '@/components/professionals/sticky-book-bar'" in t:
            t = t.replace(
                "from '@/components/professionals/sticky-book-bar'",
                "from '@/components/professionals/sticky-book-bar'\nimport { ReportProfileButton } from '@/components/professionals/report-profile-button'",
                1,
            )
        elif 'StickyBookBar' in t:
            # find first import block end
            lines = t.splitlines()
            for i, line in enumerate(lines):
                if line.startswith('import ') and 'react' in line.lower():
                    continue
            # append after last import
            out = []
            last_imp = 0
            for i, line in enumerate(lines):
                if line.startswith('import '):
                    last_imp = i
            lines.insert(last_imp + 1, "import { ReportProfileButton } from '@/components/professionals/report-profile-button';")
            t = '\n'.join(lines) + ('\n' if t.endswith('\n') else '')

        old = """      <p className="mt-4 text-center text-xs text-gray-muted">
        تخلف مشاهده کردید؟{' '}
        <a
          href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@beautijoo.ir'}?subject=${encodeURIComponent('گزارش تخلف پروفایل: ' + pro.slug)}`}
          className="text-coral underline"
        >
          گزارش تخلف
        </a>
      </p>"""
        new = "      <ReportProfileButton slug={pro.slug} title={pro.title} />"
        if old in t:
            t = t.replace(old, new, 1)
            slug.write_text(t)
            print('slug report patched')
        else:
            # softer replace mailto report
            if 'mailto:' in t and 'گزارش تخلف' in t:
                import re
                t2, n = re.subn(
                    r"<p className=\"mt-4 text-center text-xs text-gray-muted\">\s*تخلف مشاهده کردید\?[\s\S]*?</p>",
                    '      <ReportProfileButton slug={pro.slug} title={pro.title} />',
                    t,
                    count=1,
                )
                if n:
                    slug.write_text(t2)
                    print('slug report regex patched')
                else:
                    print('slug report pattern missing')
            else:
                print('slug report pattern missing')
    else:
        print('slug already has ReportProfileButton')
else:
    print('slug page missing')

# --- 2) professionals.controller search try/catch ---
ctrl = Path('backend/src/professionals/professionals.controller.ts')
if ctrl.is_file():
    c = ctrl.read_text()
    if 'searchSafe' in c or '#83.11' in c:
        print('controller search already hardened')
    else:
        # wrap return this.service.search({
        needle = '    return this.service.search({'
        if needle not in c:
            print('controller search return missing')
            sys.exit(1)
        # find the call block end - approximate: replace method body return with try/catch
        idx = c.find(needle)
        # find matching close of search({\n ... });
        end = c.find('});', idx)
        if end < 0:
            print('controller search end missing')
            sys.exit(1)
        end = end + 3
        old_block = c[idx:end]
        new_block = (
            '    // #83.11 — never leak 500 on public search; return empty page on failure\n'
            '    try {\n'
            + old_block.replace('return this.service.search(', 'return await this.service.search(', 1)
            + '\n    } catch (err) {\n'
            '      console.error("[professionals.search]", err);\n'
            '      return { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };\n'
            '    }'
        )
        # method may need async
        c = c.replace(old_block, new_block, 1)
        c = c.replace(
            '  @Get()\n  search(',
            '  @Get()\n  async search(',
            1,
        )
        ctrl.write_text(c)
        print('controller search hardened')
else:
    print('controller missing')

# --- 3) admin support: highlight report tickets ---
sup = Path('frontend/src/app/admin/support/page.tsx')
if sup.is_file():
    s = sup.read_text()
    if 'گزارش تخلف' in s and 'profile_report' in s:
        print('admin support already')
    elif 'subject' in s:
        # add badge in list if subject includes گزارش
        if 'isReport' not in s:
            s = s.replace(
                '{t.subject}',
                "{t.subject}{/(گزارش تخلف|profile_report)/i.test(t.subject || '') || t.source === 'profile_report' || t.source === 'booking_report' ? ' · تخلف' : ''}",
                1,
            )
            # type source optional
            if 'source?:' not in s and 'subject:' in s:
                s = s.replace(
                    'subject:',
                    'source?: string;\n  subject:',
                    1,
                )
            sup.write_text(s)
            print('admin support badge')
        else:
            print('admin support skip')
    else:
        print('admin support unexpected')
else:
    print('admin support missing')

print('done')
