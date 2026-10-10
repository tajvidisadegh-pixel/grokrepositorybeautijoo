from pathlib import Path
import re

changed = []

# ---- 24: morning summary with first appointment time ----
p = Path('frontend/src/app/zibagar/page.tsx')
t = p.read_text(encoding='utf-8')
if 'اولی ساعت' not in t:
    old = """{todayBookings.length > 0
                ? `امروز ${todayBookings.length.toLocaleString('fa-IR')} نوبت داری`
                : 'امروز نوبتی در برنامه نیست'}"""
    new = """{todayBookings.length > 0
                ? `امروز ${todayBookings.length.toLocaleString('fa-IR')} نوبت داری${
                    (() => {
                      const first = [...todayBookings].sort(
                        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
                      )[0];
                      if (!first?.startAt) return '';
                      try {
                        const hh = new Date(first.startAt).toLocaleTimeString('fa-IR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                          timeZone: 'Asia/Tehran',
                        });
                        return `، اولی ساعت ${hh}`;
                      } catch {
                        return '';
                      }
                    })()
                  }`
                : 'امروز نوبتی در برنامه نیست'}"""
    if old in t:
        t = t.replace(old, new, 1)
        p.write_text(t, encoding='utf-8')
        changed.append('24-morning')
    else:
        # softer: replace just the template string
        t2 = t.replace(
            "`امروز ${todayBookings.length.toLocaleString('fa-IR')} نوبت داری`",
            "`امروز ${todayBookings.length.toLocaleString('fa-IR')} نوبت داری${todayBookings[0]?.startAt ? `، اولی ساعت ${new Date([...todayBookings].sort((a,b)=>new Date(a.startAt).getTime()-new Date(b.startAt).getTime())[0].startAt).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Tehran'})}` : ''}`",
            1,
        )
        if t2 != t:
            p.write_text(t2, encoding='utf-8')
            changed.append('24-soft')
        else:
            changed.append('24-miss')
else:
    changed.append('24-exists')

# link to week calendar on dashboard
p = Path('frontend/src/app/zibagar/page.tsx')
t = p.read_text(encoding='utf-8')
if 'تقویم هفتگی' not in t:
    if 'برنامه امروز' in t:
        t = t.replace(
            '<h2 className="font-semibold">📅 برنامه امروز</h2>',
            '<div className="flex items-center justify-between gap-2">\n'
            '            <h2 className="font-semibold">📅 برنامه امروز</h2>\n'
            '            <Link href="/zibagar/bookings" className="text-xs text-blue hover:underline">تقویم هفتگی / لیست</Link>\n'
            '          </div>',
            1,
        )
        p.write_text(t, encoding='utf-8')
        changed.append('22-link')

# ---- 27: local preview before/during upload ----
p = Path('frontend/src/app/zibagar/portfolio/page.tsx')
t = p.read_text(encoding='utf-8')
if 'localPreview' not in t:
    # add state after uploadProgress
    if 'const [uploadProgress, setUploadProgress]' in t:
        t = t.replace(
            'const [uploadProgress, setUploadProgress] = useState<number | null>(null);',
            "const [uploadProgress, setUploadProgress] = useState<number | null>(null);\n"
            "  const [localPreview, setLocalPreview] = useState<string | null>(null);",
            1,
        )
    # in onUpload after setBusy(true)
    if 'setBusy(true);\n    setUploadProgress(0);' in t:
        t = t.replace(
            'setBusy(true);\n    setUploadProgress(0);\n    setMsg(null);',
            "setBusy(true);\n    setUploadProgress(0);\n    setMsg(null);\n"
            "    try {\n"
            "      const url = URL.createObjectURL(file);\n"
            "      setLocalPreview(url);\n"
            "    } catch { /* ignore */ }",
            1,
        )
    # in finally clear preview
    if 'setUploadProgress(null);' in t:
        t = t.replace(
            'setUploadProgress(null);\n      if (inputRef.current) inputRef.current.value = \'\';',
            "setUploadProgress(null);\n"
            "      if (localPreview) { try { URL.revokeObjectURL(localPreview); } catch { /* */ } }\n"
            "      setLocalPreview(null);\n"
            "      if (inputRef.current) inputRef.current.value = '';",
            1,
        )
    # UI next to progress
    if '{uploadProgress != null && (' in t and 'localPreview' not in t[t.find('{uploadProgress'):t.find('{uploadProgress')+400]:
        t = t.replace(
            '{uploadProgress != null && (',
            '{localPreview && (\n'
            '        <div className="overflow-hidden rounded-xl border border-border bg-white p-2">\n'
            '          {/* eslint-disable-next-line @next/next/no-img-element */}\n'
            '          <img src={localPreview} alt="پیش‌نمایش" className="mx-auto max-h-40 rounded-lg object-contain" />\n'
            '          <p className="mt-1 text-center text-xs text-gray">پیش‌نمایش قبل از اتمام آپلود</p>\n'
            '        </div>\n'
            '      )}\n'
            '      {uploadProgress != null && (',
            1,
        )
    p.write_text(t, encoding='utf-8')
    changed.append('27-preview')
else:
    changed.append('27-exists')

# ---- 29: block with optional reason ----
p = Path('frontend/src/app/zibagar/bookings/page.tsx')
t = p.read_text(encoding='utf-8')
if "reason?:" not in t[t.find('blockCustomer'):t.find('blockCustomer')+400] if 'blockCustomer' in t else True:
    old_fn = '''async function blockCustomer(customerId: string) {
    if (!customerId) return;
    if (typeof window !== 'undefined' && !window.confirm('این مشتری دیگر نتواند از شما نوبت بگیرد. ادامه می‌دهید؟')) return;
    setBusy(`${customerId}:block`);
    setError(null);
    try {
      await apiClient.post('/professionals/me/blocked-customers', { customerId });
      setActionMsg('مشتری مسدود شد.');'''
    new_fn = '''async function blockCustomer(customerId: string) {
    if (!customerId) return;
    if (typeof window !== 'undefined' && !window.confirm('این مشتری دیگر نتواند از شما نوبت بگیرد. ادامه می‌دهید؟')) return;
    const reason =
      typeof window !== 'undefined'
        ? window.prompt('دلیل مسدودسازی (اختیاری):') || undefined
        : undefined;
    setBusy(`${customerId}:block`);
    setError(null);
    try {
      await apiClient.post('/professionals/me/blocked-customers', { customerId, reason });
      setActionMsg('مشتری مسدود شد.');'''
    if old_fn in t:
        t = t.replace(old_fn, new_fn, 1)
        p.write_text(t, encoding='utf-8')
        changed.append('29-reason')
    else:
        # softer
        if "await apiClient.post('/professionals/me/blocked-customers', { customerId });" in t:
            t = t.replace(
                "if (typeof window !== 'undefined' && !window.confirm('این مشتری دیگر نتواند از شما نوبت بگیرد. ادامه می‌دهید؟')) return;",
                "if (typeof window !== 'undefined' && !window.confirm('این مشتری دیگر نتواند از شما نوبت بگیرد. ادامه می‌دهید؟')) return;\n"
                "    const reason = typeof window !== 'undefined' ? window.prompt('دلیل مسدودسازی (اختیاری):') || undefined : undefined;",
                1,
            )
            t = t.replace(
                "await apiClient.post('/professionals/me/blocked-customers', { customerId });",
                "await apiClient.post('/professionals/me/blocked-customers', { customerId, reason });",
                1,
            )
            p.write_text(t, encoding='utf-8')
            changed.append('29-soft')
        else:
            changed.append('29-miss')
else:
    changed.append('29-exists')

# ---- 21: ensure incomplete cannot publish - already UI locked; add note if missing ----
p = Path('frontend/src/app/zibagar/profile/page.tsx')
t = p.read_text(encoding='utf-8')
if 'قفل انتشار' not in t and 'آماده انتشار نیست' in t:
    t = t.replace(
        'پروفایل شما هنوز آماده انتشار نیست.',
        'پروفایل شما هنوز آماده انتشار نیست (انتشار تا تکمیل موارد زیر قفل است).',
        1,
    )
    p.write_text(t, encoding='utf-8')
    changed.append('21-lock-copy')

# docs summary for 21-30
Path('docs').mkdir(exist_ok=True)
doc = Path('docs/issue-62-week3-zibagar.md')
if not doc.exists():
    doc.write_text(
        "# ایشو ۶۲ — هفته ۳ پنل زیباگر (۲۱–۳۰)\n\n"
        "- ۲۱: CompletionBar + قفل انتشار تا complete\n"
        "- ۲۲: لیست + تقویم هفتگی در /zibagar/bookings\n"
        "- ۲۳: confirm/reject/cancel/complete/reschedule/no-show\n"
        "- ۲۴: خلاصه صبحگاهی با ساعت اولین نوبت\n"
        "- ۲۵: هشدار تداخل ساعات/مرخصی\n"
        "- ۲۶–۲۷: سقف پورتفولیو + progress + پیش‌نمایش\n"
        "- ۲۸: جستجوی نام/شماره در رزروها\n"
        "- ۲۹: بلاک مشتری با دلیل اختیاری\n"
        "- ۳۰: بنر pending_review\n",
        encoding='utf-8',
    )
    changed.append('docs')

print('CHANGED', changed)
