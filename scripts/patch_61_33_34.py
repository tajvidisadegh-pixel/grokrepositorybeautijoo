from pathlib import Path
import re

# 33 fraud card on admin dashboard
p = Path('frontend/src/app/admin/page.tsx')
t = p.read_text(encoding='utf-8')
if 'هشدار تقلب' not in t:
    card = '''
      <Card className="space-y-2 p-4">
        <h2 className="font-semibold">هشدار تقلب / نرخ غیرعادی</h2>
        <p className="text-xs text-gray">
          رزروهای لغوشده پرتکرار و OTP مشکوک را از لاگ audit بررسی کنید.
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          <a href="/admin/audit" className="text-coral underline">لاگ audit</a>
          <a href="/admin/bookings" className="text-coral underline">رزروها</a>
          <a href="/admin/users" className="text-coral underline">کاربران</a>
        </div>
      </Card>
'''
    idx = t.rfind('    </div>\n  );\n}')
    if idx < 0:
        idx = t.rfind('  );\n}')
    if idx > 0:
        # insert before last closing of return
        # find last return's outer close more carefully
        m = list(re.finditer(r'\n    </div>\n  \);\n\}', t))
        if m:
            pos = m[-1].start()
            t = t[:pos] + '\n' + card + t[pos:]
            p.write_text(t, encoding='utf-8')
            print('33 ok')
        else:
            print('33 place miss')
    else:
        print('33 no idx')
else:
    print('33 exists')

# 34 suspend reason prompt
p = Path('frontend/src/app/admin/users/page.tsx')
t = p.read_text(encoding='utf-8')
if 'دلیل تعلیق' not in t:
    # wrap changeStatus call for suspended
    t2 = t.replace(
        "onClick={() => changeStatus(u.id, 'suspended')}",
        "onClick={() => { const r = window.prompt('دلیل تعلیق / مسدودسازی:'); if (r === null) return; void changeStatus(u.id, 'suspended'); }}",
    )
    # also try changeStatus definition to pass reason if API accepts
    if "const changeStatus = async (id: string, newStatus: string)" in t2:
        t2 = t2.replace(
            "const changeStatus = async (id: string, newStatus: string) => {\n    setBusy(true);",
            "const changeStatus = async (id: string, newStatus: string) => {\n    const reason = (newStatus === 'suspended' || newStatus === 'blocked')\n      ? (window.prompt('دلیل تعلیق (اختیاری):') ?? undefined)\n      : undefined;\n    if ((newStatus === 'suspended' || newStatus === 'blocked') && reason === undefined && false) return;\n    setBusy(true);",
            1,
        )
        t2 = t2.replace(
            "await adminSetUserStatus(id, newStatus === 'blocked' ? 'suspended' : newStatus);",
            "await adminSetUserStatus(id, newStatus === 'blocked' ? 'suspended' : newStatus, reason);",
            1,
        )
    p.write_text(t2, encoding='utf-8')
    print('34 ok')
else:
    print('34 exists')
