# -*- coding: utf-8 -*-
from pathlib import Path

p = Path('frontend/src/app/panel/settings/page.tsx')
t = p.read_text(encoding='utf-8')

broken_start = "        'خطا در \n"
if "'خطا در" in t and '<Card className="space-y-3 p-4">' in t:
    # Fix the broken catch: restore error string and extract Card
    import re
    # Match from broken string through the erroneous Card and closing quote
    pattern = re.compile(
        r"'خطا در\s*\n\s*<Card className=\"space-y-3 p-4\">.*?</Card>\nحذف حساب';",
        re.DOTALL,
    )
    m = pattern.search(t)
    if m:
        card = None
        # extract card inner
        card_m = re.search(
            r'(<Card className="space-y-3 p-4">.*?</Card>)',
            m.group(0),
            re.DOTALL,
        )
        if card_m:
            card = card_m.group(1)
        t = pattern.sub("'خطا در حذف حساب';", t, count=1)
        print('fixed broken catch')
        if card and card not in t:
            # insert card before delete account Card in JSX
            # look for delete form / حذف حساب کاربری heading in return
            markers = [
                'حذف حساب کاربری',
                'حذف دائمی حساب',
                'deleteConfirm',
            ]
            inserted = False
            # Find in return section: <Card near delete
            # Search for form onSubmit={onDeleteAccount}
            if 'onSubmit={onDeleteAccount}' in t:
                idx = t.find('onSubmit={onDeleteAccount}')
                # walk back to <Card or <form
                start = t.rfind('<Card', 0, idx)
                if start < 0:
                    start = t.rfind('<form', 0, idx)
                if start > 0:
                    t = t[:start] + card + '\n\n      ' + t[start:]
                    inserted = True
                    print('inserted card before delete form')
            if not inserted:
                # before last Card in file
                idx = t.rfind('<Card')
                if idx > 0:
                    t = t[:idx] + card + '\n\n      ' + t[idx:]
                    print('inserted card before last Card')
    else:
        print('pattern not matched, trying alternate fix')
        # simpler: replace the whole broken region by line markers
        if "'خطا در" in t and 'حذف حساب';' in t:
            a = t.find("'خطا در")
            b = t.find("حذف حساب';", a)
            if a > 0 and b > a:
                # extract card
                cs = t.find('<Card', a)
                ce = t.find('</Card>', cs)
                card = t[cs:ce+7] if cs > 0 and ce > cs else None
                t = t[:a] + "'خطا در حذف حساب';" + t[b+len('حذف حساب';'):]
                print('alternate catch fix')
                if card and card not in t:
                    if 'onSubmit={onDeleteAccount}' in t:
                        idx = t.find('onSubmit={onDeleteAccount}')
                        start = t.rfind('<', 0, idx)
                        # find Card before form
                        start = t.rfind('<Card', 0, idx)
                        if start > 0:
                            t = t[:start] + card + '\n\n      ' + t[start:]
                            print('card placed')
else:
    print('no breakage detected or already fixed')

# Ensure phone handlers and imports still present
for need in ['requestChangePhone', 'onRequestPhoneChange', 'newPhone', 'phoneStep']:
    print(need, need in t)

p.write_text(t, encoding='utf-8')
print('final len', len(t))
# quick syntax sanity: balanced braces
print('brace delta', t.count('{') - t.count('}'))
print('paren delta', t.count('(') - t.count(')'))
