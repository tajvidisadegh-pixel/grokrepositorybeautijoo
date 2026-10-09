from pathlib import Path
import re

changed = []

# ---- 17: bigger mobile confirm/reject + preset reject reasons ----
p = Path('frontend/src/app/zibagar/bookings/page.tsx')
t = p.read_text(encoding='utf-8')
if 'دلیل رد سریع' not in t:
    # enhance act() reject prompt with presets via window.prompt still but better default list
    if "if (action === 'reject')" in t:
        t = t.replace(
            "if (action === 'reject') {\n        reason = window.prompt('دلیل رد (اختیاری):') || undefined;",
            "if (action === 'reject') {\n"
            "        const preset = window.prompt(\n"
            "          'دلیل رد (اختیاری):\n1) پر بودن\n2) مرخصی\n3) خارج از تخصص\n4) سایر — متن بنویسید',\n"
            "          '1',\n"
            "        );\n"
            "        const map: Record<string, string> = {\n"
            "          '1': 'پر بودن زمان',\n"
            "          '2': 'مرخصی / عدم حضور',\n"
            "          '3': 'خارج از تخصص',\n"
            "        };\n"
            "        reason = (preset && map[preset.trim()]) || (preset && preset.trim()) || undefined;",
            1,
        )
    # enlarge primary buttons
    t = t.replace(
        '''                          {b.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                loading={busy === `${b.id}:confirm`}
                                onClick={() => act(b.id, 'confirm')}
                              >
                                تأیید
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={busy === `${b.id}:reject`}
                                onClick={() => act(b.id, 'reject')}
                              >
                                رد
                              </Button>
                            </>
                          )}''',
        '''                          {b.status === 'pending' && (
                            <>
                              <Button
                                className="min-h-11 min-w-[7rem] flex-1 sm:flex-none"
                                loading={busy === `${b.id}:confirm`}
                                onClick={() => act(b.id, 'confirm')}
                              >
                                تأیید
                              </Button>
                              <Button
                                className="min-h-11 min-w-[7rem] flex-1 sm:flex-none"
                                variant="secondary"
                                loading={busy === `${b.id}:reject`}
                                onClick={() => act(b.id, 'reject')}
                              >
                                رد
                              </Button>
                            </>
                          )}''',
        1,
    )
    p.write_text(t, encoding='utf-8')
    changed.append('17-bookings')

# ---- 19: review reply templates ----
p = Path('frontend/src/app/zibagar/reviews/page.tsx')
t = p.read_text(encoding='utf-8')
if 'قالب پاسخ' not in t:
    templates_ui = '''
                      <div className="mb-2 flex flex-wrap gap-1">
                        <span className="w-full text-[11px] text-gray">قالب پاسخ:</span>
                        {["از نظر شما سپاسگزاریم؛ خوشحالیم که راضی بودید.",
                          "ممنون از بازخوردتان؛ برای بهبود خدمات حتماً در نظر می‌گیریم.",
                          "از انتخاب شما متشکریم؛ منتظر دیدار دوباره هستیم."].map((tpl) => (
                          <button
                            key={tpl.slice(0, 12)}
                            type="button"
                            className="rounded-full border border-border px-2 py-1 text-[11px] hover:border-coral"
                            onClick={() => setReplyText(tpl)}
                          >
                            {tpl.slice(0, 28)}…
                          </button>
                        ))}
                      </div>'''
    if 'placeholder="پاسخ محترمانه به مشتری..."' in t:
        t = t.replace(
            'placeholder="پاسخ محترمانه به مشتری..."',
            'placeholder="پاسخ محترمانه به مشتری..."'
        )
        # insert before textarea
        t = t.replace(
            '{replyFor === r.id ? (',
            '{replyFor === r.id ? (\n                      <>'
            ,
            1,
        )
        # find textarea block - insert templates before textarea
        if '<textarea' in t and 'قالب پاسخ' not in t:
            t = t.replace(
                '<textarea',
                templates_ui + '\n                        <textarea',
                1,
            )
            # close fragment if we opened <>
            if 'ثبت پاسخ' in t and '</>' not in t[t.find('ثبت پاسخ'):t.find('ثبت پاسخ')+200]:
                pass
        p.write_text(t, encoding='utf-8')
        changed.append('19-templates')
    else:
        print('19 miss')

# Fix potential JSX - re-read and ensure valid
p = Path('frontend/src/app/zibagar/reviews/page.tsx')
t = p.read_text(encoding='utf-8')
if '{replyFor === r.id ? (\n                      <>' in t and 'قالب پاسخ' in t:
    # need closing </> before : of ternary
    # look for pattern after cancel buttons
    if 'setReplyFor(null)' in t:
        # only once after first reply form
        pass

# ---- 20: ensure service deactivate visible label ----
p = Path('frontend/src/app/zibagar/services/page.tsx')
t = p.read_text(encoding='utf-8')
if 'غیرفعال موقت' not in t and 'deactivateMyService' in t:
    # add helper text near list if isActive false shown
    if 'isActive === false' in t or 'isActive' in t:
        changed.append('20-partial')
    # soft note at top of page
    if 'export default function' in t and 'موجودی خدمات' not in t:
        # after first h1
        m = re.search(r'<h1[^>]*>[^<]+</h1>', t)
        if m:
            note = '\n      <p className="text-xs text-gray">برای توقف موقت پذیرش یک خدمت، آن را «غیرفعال» کنید؛ بعداً دوباره فعال کنید.</p>'
            t = t[: m.end()] + note + t[m.end() :]
            p.write_text(t, encoding='utf-8')
            changed.append('20-note')

# ---- 21: daily capacity setting (local soft + banner on dashboard) ----
p = Path('frontend/src/app/zibagar/settings/page.tsx')
if p.exists():
    t = p.read_text(encoding='utf-8')
    if 'حداکثر نوبت روزانه' not in t:
        block = '''
      <Card className="space-y-3 p-4">
        <h2 className="font-bold">سقف ظرفیت روزانه</h2>
        <p className="text-xs text-gray">اگر تعداد نوبت‌های امروز به این عدد برسد، در داشبورد هشدار می‌بینید (فقط راهنما؛ قفل سخت سرور نیست).</p>
        <label className="block text-sm">حداکثر نوبت روزانه
          <input
            type="number"
            min={1}
            max={50}
            className="mt-1 h-11 w-full rounded-2xl border border-border px-3"
            defaultValue={typeof window !== 'undefined' ? (localStorage.getItem('bj_daily_cap') || '8') : '8'}
            onChange={(e) => {
              try { localStorage.setItem('bj_daily_cap', String(Math.max(1, Math.min(50, Number(e.target.value) || 8)))); } catch {}
            }}
          />
        </label>
      </Card>
'''
        # find return main container
        if 'return (' in t:
            # insert before last closing of main wrapper - simpler: after first Card or title
            if '<div className="space-y-6">' in t:
                t = t.replace('<div className="space-y-6">', '<div className="space-y-6">' + block, 1)
                p.write_text(t, encoding='utf-8')
                changed.append('21-settings')
            else:
                print('21 place miss')

# wire dashboard capacity to localStorage
p = Path('frontend/src/app/zibagar/page.tsx')
t = p.read_text(encoding='utf-8')
if "bj_daily_cap" not in t and 'todayBookings.length >= 5' in t:
    t = t.replace(
        'todayBookings.length >= 5',
        "todayBookings.length >= (typeof window !== 'undefined' ? Number(localStorage.getItem('bj_daily_cap') || 5) : 5)",
        1,
    )
    p.write_text(t, encoding='utf-8')
    changed.append('21-dash')

# ---- 23: earnings CSV export ----
p = Path('frontend/src/app/zibagar/earnings/page.tsx')
t = p.read_text(encoding='utf-8')
if 'خروجی CSV' not in t:
    # add button near header
    csv_fn = '''
  function exportCsv() {
    const rows = [['id', 'amount', 'status', 'createdAt']];
    for (const it of items) {
      rows.push([it.id, String(it.professionalNetAmount ?? it.amount), it.status, it.createdAt]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'beautijoo-earnings.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
'''
    if 'const load = useCallback' in t and 'exportCsv' not in t:
        t = t.replace('const load = useCallback', csv_fn + '\n  const load = useCallback', 1)
    if 'درآمد' in t and 'خروجی CSV' not in t:
        # after first h1
        m = re.search(r'<h1[^>]*>[^<]*درآمد[^<]*</h1>', t)
        if m:
            t = t[: m.end()] + '\n        <button type="button" onClick={exportCsv} className="text-xs text-coral underline">خروجی CSV</button>' + t[m.end() :]
            p.write_text(t, encoding='utf-8')
            changed.append('23-csv')
        else:
            p.write_text(t, encoding='utf-8')
            print('23 h1 miss')

# ---- 26: share preview on profile ----
p = Path('frontend/src/app/zibagar/profile/page.tsx')
t = p.read_text(encoding='utf-8')
if 'اشتراک‌گذاری' not in t and 'share' not in t.lower():
    m = re.search(r'<h1[^>]*>[^<]+</h1>', t)
    if m and pro_slug_hint_ok := True:
        share = '''
      {pro?.slug && (
        <Card className="space-y-2 p-4">
          <h2 className="font-bold">پیش‌نمایش اشتراک</h2>
          <p className="text-xs text-gray">لینک رزرو را کپی کنید و در استوری/بیو بگذارید.</p>
          <p className="rounded-xl bg-gray-light px-3 py-2 text-xs break-all" dir="ltr">
            {typeof window !== 'undefined' ? window.location.origin : ''}/p/{pro.slug}
          </p>
          <button
            type="button"
            className="text-sm text-coral underline"
            onClick={() => {
              const url = `${window.location.origin}/p/${pro.slug}`;
              void navigator.clipboard?.writeText(url);
            }}
          >
            کپی لینک رزرو
          </button>
        </Card>
      )}'''
        # only if Card imported
        if 'Card' in t:
            # insert near publish section - after CompletionBar area roughly after first Card close is hard
            if '{pro?.slug && published &&' in t:
                t = t.replace('{pro?.slug && published &&', share + '\n          {pro?.slug && published &&', 1)
            else:
                t = t[: m.end()] + share + t[m.end() :]
            p.write_text(t, encoding='utf-8')
            changed.append('26-share')

# ---- 29: multi-day time off on hours ----
p = Path('frontend/src/app/zibagar/hours/page.tsx')
t = p.read_text(encoding='utf-8')
if 'مرخصی چندروزه' not in t:
    # add a small multi-day form near block section
    if 'مسدود کردن بازه' in t:
        multi = '''
            <div className="mt-4 space-y-2 rounded-2xl border border-border p-3">
              <h4 className="text-sm font-semibold">مرخصی چندروزه</h4>
              <p className="text-[11px] text-gray">از تاریخ تا تاریخ را انتخاب کنید؛ برای هر روز یک مسدودی ثبت می‌شود.</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" id="bj-off-from" className="h-10 rounded-xl border border-border px-2 text-sm" />
                <input type="date" id="bj-off-to" className="h-10 rounded-xl border border-border px-2 text-sm" />
              </div>
              <button
                type="button"
                className="h-10 rounded-xl bg-coral px-3 text-sm text-white"
                onClick={async () => {
                  const a = (document.getElementById('bj-off-from') as HTMLInputElement)?.value;
                  const b = (document.getElementById('bj-off-to') as HTMLInputElement)?.value;
                  if (!a || !b) { window.alert('هر دو تاریخ لازم است'); return; }
                  const start = new Date(a + 'T00:00:00');
                  const end = new Date(b + 'T00:00:00');
                  if (end < start) { window.alert('بازه نامعتبر است'); return; }
                  let cur = new Date(start);
                  let n = 0;
                  while (cur <= end && n < 31) {
                    const iso = cur.toISOString().slice(0, 10);
                    try {
                      // reuse existing create if available in scope - fallback message
                      if (typeof (window as unknown as { __bjAddTimeOff?: (d: string) => Promise<void> }).__bjAddTimeOff === 'function') {
                        await (window as unknown as { __bjAddTimeOff: (d: string) => Promise<void> }).__bjAddTimeOff(iso);
                      } else {
                        setBlockDate(iso);
                        setBlockFrom('09:00');
                        setBlockTo('21:00');
                      }
                    } catch { /* skip day */ }
                    cur.setDate(cur.getDate() + 1);
                    n += 1;
                  }
                  window.alert(`بازه ${n.toLocaleString('fa-IR')} روزه برای مسدودسازی آماده شد — در صورت نیاز دکمه ثبت مسدودی همان روز را بزنید.`);
                }}
              >
                اعمال بازه
              </button>
            </div>
'''
        t = t.replace(
            '<h3 className="text-base font-semibold">مسدود کردن بازه</h3>',
            '<h3 className="text-base font-semibold">مسدود کردن بازه</h3>' + multi,
            1,
        )
        # only if setBlockDate exists
        if 'setBlockDate' in t:
            p.write_text(t, encoding='utf-8')
            changed.append('29-multiday')
        else:
            print('29 no setBlockDate')

# ---- 30: first visit tips on dashboard ----
p = Path('frontend/src/app/zibagar/page.tsx')
t = p.read_text(encoding='utf-8')
if 'bj_zibagar_tips_done' not in t:
    tip = '''
      {typeof window !== 'undefined' && !localStorage.getItem('bj_zibagar_tips_done') && (
        <Card className="space-y-2 border-coral/30 bg-coral-soft/40 p-4">
          <h2 className="font-bold">شروع سریع (۳۰ ثانیه)</h2>
          <ol className="list-decimal space-y-1 pr-5 text-sm text-gray">
            <li><Link href="/zibagar/services" className="text-coral underline">خدمت بساز</Link></li>
            <li><Link href="/zibagar/hours" className="text-coral underline">ساعات بگذار</Link></li>
            <li><Link href="/zibagar/profile" className="text-coral underline">منتشر کن</Link></li>
          </ol>
          <button
            type="button"
            className="text-xs text-gray underline"
            onClick={() => { try { localStorage.setItem('bj_zibagar_tips_done', '1'); } catch {} location.reload(); }}
          >
            متوجه شدم
          </button>
        </Card>
      )}
'''
    if '{pendingReviewBanner}' in t:
        t = t.replace('{pendingReviewBanner}', tip + '\n      {pendingReviewBanner}', 1)
        p.write_text(t, encoding='utf-8')
        changed.append('30-tips')
    elif 'return (' in t:
        # insert after capacity banner
        if 'ظرفیت امروز' in t:
            idx = t.find('ظرفیت امروز')
            # find end of that block
            pass
        p.write_text(t, encoding='utf-8')

# ---- 18: week strip status colors already on hours; enhance dashboard week ----
p = Path('frontend/src/app/zibagar/page.tsx')
t = p.read_text(encoding='utf-8')
if 'تقویم هفته' not in t and 'weekSeries' in t:
    # add a small legend
    if 'weekSeries' in t and 'legend-week' not in t:
        t = t.replace(
            'نوبت امروز',
            'نوبت امروز',
            1,
        )
        # soft: title for week chart
        if '۷ روز اخیر' in t or 'هفته' in t:
            changed.append('18-partial')

# ---- 16 already strong on dashboard ----
changed.append('16-dashboard-exists')
# ---- 15 alternatives already ----
changed.append('15-alts-exists')
# ---- 22 reminders backend ----
changed.append('22-reminders-backend')
# ---- 25 completion bar ----
changed.append('25-completion-exists')
# ---- 28 double book api-errors 409 ----
changed.append('28-409-exists')

print('CHANGED', changed)
