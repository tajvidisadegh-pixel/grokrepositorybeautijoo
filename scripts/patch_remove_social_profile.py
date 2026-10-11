from pathlib import Path
import re

p = Path('frontend/src/app/zibagar/profile/page.tsx')
t = p.read_text(encoding='utf-8')

# Hide social contact fields UI — product decision: no WA/TG/IG on platform
old = "{([['instagram','اینستاگرام'],['telegram','تلگرام'],['website','وب‌سایت'],['phone','شماره تماس'],['whatsapp','واتساپ']] as const).map(([key,label]) =>"
if old in t:
    # find the map block and wrap to empty array
    t = t.replace(
        "{([['instagram','اینستاگرام'],['telegram','تلگرام'],['website','وب‌سایت'],['phone','شماره تماس'],['whatsapp','واتساپ']] as const).map(([key,label]) =>",
        "{([] as const).map(([key,label]) =>",
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('profile form social fields hidden')
else:
    # try alternate quote styles
    m = re.search(r"instagram.*واتساپ", t)
    print('alt', bool(m))
    if 'اینستاگرام' in t:
        t = re.sub(
            r"\{\(\[\['instagram'[^\]]+\]\] as const\)\.map",
            '{([] as const).map',
            t,
            count=1,
        )
        p.write_text(t, encoding='utf-8')
        print('regex hide')
    else:
        print('no social form')
