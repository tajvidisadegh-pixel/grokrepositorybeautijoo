from pathlib import Path

# 44 login expired
p = Path('frontend/src/app/login/page.tsx')
t = p.read_text(encoding='utf-8')
if 'sessionExpired' not in t:
    t = t.replace(
        'const nextParam = search?.get('\''next'\'');\n  const asParam = search?.get('\''as'\'');',
        'const nextParam = search?.get('\''next'\'');\n  const asParam = search?.get('\''as'\'');\n  const sessionExpired = search?.get('\''expired'\'') === '\''1'\'';',
        1,
    )
# also try without escaped quotes mess
if 'sessionExpired' not in t:
    t = t.replace(
        "const nextParam = search?.get('next');\n  const asParam = search?.get('as');",
        "const nextParam = search?.get('next');\n  const asParam = search?.get('as');\n  const sessionExpired = search?.get('expired') === '1';",
        1,
    )
if 'نشست شما منقضی شده است' not in t and 'sessionExpired' in t:
    # find return of LoginForm
    # insert after first Card or form open
    if '<Card' in t:
        t = t.replace(
            '<Card',
            '{sessionExpired && (\n        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">\n          نشست شما منقضی شده است. لطفاً دوباره وارد شوید.\n        </div>\n      )}\n      <Card',
            1,
        )
p.write_text(t, encoding='utf-8')
print('44', 'sessionExpired' in t, 'نشست شما منقضی' in t)

# 47 wizard
p = Path('frontend/src/components/booking/booking-wizard.tsx')
t = p.read_text(encoding='utf-8')
if 'حداقل چند ساعت قبل از نوبت' not in t:
    t = t.replace(
        '<Button className="w-full" disabled={!slotStart} onClick={goSummary}>\n            ادامه به خلاصه\n          </Button>',
        '<p className="text-xs text-gray">رزرو باید حداقل چند ساعت قبل از نوبت ثبت شود؛ زمان‌های خیلی نزدیک قبول نمی‌شوند.</p>\n          <Button className="w-full" disabled={!slotStart} onClick={goSummary}>\n            ادامه به خلاصه\n          </Button>',
        1,
    )
    p.write_text(t, encoding='utf-8')
print('47', 'حداقل چند ساعت قبل از نوبت' in p.read_text(encoding='utf-8'))

# 45 spacing fix
p = Path('frontend/src/app/professionals/[slug]/page.tsx')
t = p.read_text(encoding='utf-8')
t2 = t.replace('تخلف مشاهده کردید؟{}', "تخلف مشاهده کردید؟{' '}")
if t2 != t:
    p.write_text(t2, encoding='utf-8')
    print('45 fixed')
else:
    print('45 ok or different')
