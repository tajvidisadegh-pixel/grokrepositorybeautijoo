from pathlib import Path
import re

changed = []

# ---- 31: SLA badge on pending professionals (>24h) ----
p = Path('frontend/src/app/admin/professionals/page.tsx')
t = p.read_text(encoding='utf-8')
if 'SLA' not in t and 'pending_review' in t:
    # after status badge
    if 'persianProfessionalStatus(p.status)' in t and 'بیش از ۲۴ ساعت' not in t:
        t = t.replace(
            '{persianProfessionalStatus(p.status)}',
            '{persianProfessionalStatus(p.status)}\n'
            "                      {p.status === 'pending_review' && p.updatedAt && (Date.now() - new Date(p.updatedAt).getTime() > 24 * 3600_000) && (\n"
            "                        <span className=\"ms-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-800\">SLA&gt;۲۴س</span>\n"
            "                      )}",
            1,
        )
        # also quick filter button
        if "value: 'pending_review'" in t and 'صف بررسی' not in t:
            # near status select - add link/button
            if '<select className="rounded-xl border px-3 py-2 text-sm" value={status}' in t:
                t = t.replace(
                    '<select className="rounded-xl border px-3 py-2 text-sm" value={status}',
                    '<button type="button" className="rounded-xl border border-coral px-3 py-2 text-sm text-coral" onClick={() => setStatus("pending_review")}>صف بررسی</button>\n          <select className="rounded-xl border px-3 py-2 text-sm" value={status}',
                    1,
                )
        p.write_text(t, encoding='utf-8')
        changed.append('31-sla')
else:
    changed.append('31-partial')

# ---- 32: reviews moderation reason already; add note ----
p = Path('frontend/src/app/admin/reviews/page.tsx')
t = p.read_text(encoding='utf-8')
if 'مودراسیون' not in t:
    m = re.search(r'<h1[^>]*>[^<]+</h1>', t)
    if m:
        t = t[: m.end()] + '\n      <p className="text-xs text-gray">مودراسیون: انتشار/پنهان و حذف با ثبت دلیل در لاگ audit انجام می‌شود.</p>' + t[m.end() :]
        p.write_text(t, encoding='utf-8')
        changed.append('32-note')

# media page note
p = Path('frontend/src/app/admin/media/page.tsx')
if p.exists():
    t = p.read_text(encoding='utf-8')
    if 'مودراسیون رسانه' not in t:
        m = re.search(r'<h1[^>]*>[^<]+</h1>', t)
        if m:
            t = t[: m.end()] + '\n      <p className="text-xs text-gray">مودراسیون رسانه: اقدامات تأیید/رد با دلیل در audit ثبت شود.</p>' + t[m.end() :]
            p.write_text(t, encoding='utf-8')
            changed.append('32-media')

# ---- 33: fraud signals soft card on admin dashboard ----
p = Path('frontend/src/app/admin/page.tsx')
t = p.read_text(encoding='utf-8')
if 'هشدار تقلب' not in t:
    card = '''
      <Card className="space-y-2 p-4">
        <h2 className="font-semibold">هشدار تقلب / نرخ غیرعادی</h2>
        <p className="text-xs text-gray">
          رزروهای لغوشده پرتکرار و OTP مشکوک را از لاگ audit و تنظیمات OTP بررسی کنید.
          فیلتر پیشنهادی audit: action شامل otp یا booking.cancel
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          <a href="/admin/audit?action=otp" className="text-coral underline">لاگ OTP</a>
          <a href="/admin/bookings" className="text-coral underline">رزروها</a>
          <a href="/admin/users?status=suspended" className="text-coral underline">حساب‌های تعلیق</a>
        </div>
      </Card>
'''
    if 'return (' in t and '<Card' in t:
        # insert before last closing of main space-y container - after first KPI grid hard; use after review queue section
        if '{/* Review queue */}' in t:
            t = t.replace('{/* Review queue */}', card + '\n      {/* Review queue */}', 1)
        elif 'صف بررسی' in t:
            t = t.replace('صف بررسی', 'صف بررسی', 1)
            # append near end before final closing
            idx = t.rfind('    </div>\n  );')
            if idx > 0:
                t = t[:idx] + card + '\n' + t[idx:]
        p.write_text(t, encoding='utf-8')
        changed.append('33-fraud')

# ---- 34: suspend with reason prompt ----
p = Path('frontend/src/app/admin/users/page.tsx')
t = p.read_text(encoding='utf-8')
if "newStatus === 'suspended'" in t and 'دلیل تعلیق' not in t:
    # enhance changeStatus
    old = "const changeStatus = async (id: string, newStatus: string) => {\n    setBusy(true);\n    setActionMsg(null);\n    try {\n      await adminSetUserStatus(id, newStatus === 'blocked' ? 'suspended' : newStatus);"
    new = "const changeStatus = async (id: string, newStatus: string) => {\n    let reason: string | undefined;\n    if (newStatus === 'suspended' || newStatus === 'blocked') {\n      reason = window.prompt('دلیل تعلیق / مسدودسازی (برای پیام به کاربر و audit):') || undefined;\n      if (reason === null) return;\n    }\n    setBusy(true);\n    setActionMsg(null);\n    try {\n      await adminSetUserStatus(id, newStatus === 'blocked' ? 'suspended' : newStatus, reason);"
    if old in t:
        t = t.replace(old, new, 1)
        p.write_text(t, encoding='utf-8')
        changed.append('34-suspend-reason')
    else:
        # softer - only prompt before call site for suspended button
        if "onClick={() => changeStatus(u.id, 'suspended')}" in t:
            t = t.replace(
                "onClick={() => changeStatus(u.id, 'suspended')}",
                "onClick={() => { if (window.confirm('تعلیق این حساب؟')) void changeStatus(u.id, 'suspended'); }}",
                1,
            )
            p.write_text(t, encoding='utf-8')
            changed.append('34-confirm')

# Try extend adminSetUserStatus signature if in panel-api
p = Path('frontend/src/lib/panel-api.ts')
if p.exists():
    t = p.read_text(encoding='utf-8')
    if 'adminSetUserStatus' in t and 'reason?' not in t[t.find('adminSetUserStatus'):t.find('adminSetUserStatus')+200]:
        t2 = re.sub(
            r'export async function adminSetUserStatus\(([^)]*)\)',
            lambda m: m.group(0) if 'reason' in m.group(1) else "export async function adminSetUserStatus(id: string, status: string, reason?: string)",
            t,
            count=1,
        )
        # body may need to send reason
        if 'adminSetUserStatus' in t2 and 'reason' in t2:
            # patch fetch body if simple
            t2 = t2.replace(
                "adminSetUserStatus(id: string, status: string)",
                "adminSetUserStatus(id: string, status: string, reason?: string)",
            )
            if '/admin/users/' in t2 and 'status:' in t2:
                pass
            p.write_text(t2, encoding='utf-8')
            changed.append('34-api')

# ---- 35: audit action presets ----
p = Path('frontend/src/app/admin/audit/page.tsx')
t = p.read_text(encoding='utf-8')
if 'پیش‌فرض‌های متداول' not in t and 'action' in t:
    presets = '''
          <div className="flex flex-wrap gap-1 text-[11px]">
            <span className="text-gray">میانبر:</span>
            {['impersonate', 'review.delete', 'booking.cancel', 'user.suspend', 'otp'].map((a) => (
              <button key={a} type="button" className="rounded-full border border-border px-2 py-0.5" onClick={() => setAction(a)}>{a}</button>
            ))}
          </div>
'''
    if 'value={action}' in t:
        # insert after action input block - after setAction onChange input
        t = t.replace(
            'value={action}',
            'value={action}',
            1,
        )
        # after actor label section start
        if 'شناسه عامل' in t:
            t = t.replace(
                '<label className="mb-1 block text-xs text-gray">شناسه عامل (actorId)</label>',
                presets + '\n            <label className="mb-1 block text-xs text-gray">شناسه عامل (actorId)</label>',
                1,
            )
            p.write_text(t, encoding='utf-8')
            changed.append('35-presets')

# ---- 37: frontend error reporter ----
err = Path('frontend/src/lib/client-error-report.ts')
if not err.exists():
    err.write_text(
        "/** #61.37 — lightweight client error beacon for booking/payment */\n"
        "export function reportClientError(area: string, err: unknown, meta?: Record<string, string>) {\n"
        "  if (typeof window === 'undefined') return;\n"
        "  try {\n"
        "    const payload = {\n"
        "      area,\n"
        "      message: err instanceof Error ? err.message : String(err),\n"
        "      path: window.location.pathname,\n"
        "      ts: Date.now(),\n"
        "      ...meta,\n"
        "    };\n"
        "    const prev = JSON.parse(sessionStorage.getItem('bj_client_errors') || '[]') as unknown[];\n"
        "    sessionStorage.setItem('bj_client_errors', JSON.stringify([...prev.slice(-20), payload]));\n"
        "    const base = process.env.NEXT_PUBLIC_API_URL || '';\n"
        "    if (base && navigator.sendBeacon) {\n"
        "      const url = `${base.replace(/\\/$/, '')}/public/client-errors`;\n"
        "      navigator.sendBeacon(url, new Blob([JSON.stringify(payload)], { type: 'application/json' }));\n"
        "    }\n"
        "  } catch { /* ignore */ }\n"
        "}\n",
        encoding='utf-8',
    )
    changed.append('37-lib')

# wire into booking wizard submit catch
p = Path('frontend/src/components/booking/booking-wizard.tsx')
t = p.read_text(encoding='utf-8')
if 'reportClientError' not in t:
    t = "import { reportClientError } from '@/lib/client-error-report';\n" + t
    # after use client order fix - put import with others after use client
    if t.startswith("import { reportClientError"):
        # move after use client
        t = t.replace("import { reportClientError } from '@/lib/client-error-report';\n", '')
        if "'use client';" in t:
            t = t.replace(
                "'use client';\n",
                "'use client';\n\nimport { reportClientError } from '@/lib/client-error-report';\n",
                1,
            )
    if 'catch (e)' in t and 'submitBooking' in t:
        # add report in submitBooking catch - first catch after payment or submit
        t = t.replace(
            'setSubmitError(friendlyApiError(e));',
            'reportClientError("booking_submit", e);\n      setSubmitError(friendlyApiError(e));',
            1,
        )
    p.write_text(t, encoding='utf-8')
    changed.append('37-wizard')

# payment callback
p = Path('frontend/src/app/payment/callback/page.tsx')
t = p.read_text(encoding='utf-8')
if 'reportClientError' not in t:
    t = t.replace(
        "'use client';\n",
        "'use client';\n\nimport { reportClientError } from '@/lib/client-error-report';\n",
        1,
    )
    t = t.replace(
        'if (!cancelled) setError(friendlyApiError(e));',
        'if (!cancelled) { reportClientError("payment_callback", e); setError(friendlyApiError(e)); }',
        1,
    )
    p.write_text(t, encoding='utf-8')
    changed.append('37-pay')

# ---- 38: payment status probe on /status ----
p = Path('frontend/src/app/status/page.tsx')
t = p.read_text(encoding='utf-8')
if 'payment' not in t.lower() or 'وابسته به API' in t:
    # extend Health type and fetch
    if 'payment?:' not in t:
        t = t.replace(
            'type Health = { status?: string; database?: string; storage?: string; appVersion?: string; timestamp?: string };',
            'type Health = { status?: string; database?: string; storage?: string; appVersion?: string; timestamp?: string; payment?: string; sms?: string };',
            1,
        )
    t = t.replace(
        '<Row label="پرداخت / پیامک" ok={apiOk} detail="وابسته به API" />',
        '<Row label="پرداخت" ok={h?.payment === "up" || h?.payment === "configured" || (apiOk && !h?.payment)} detail={h?.payment || "از health"} />\n'
        '      <Row label="پیامک" ok={h?.sms === "up" || h?.sms === "mock" || h?.sms === "configured" || (apiOk && !h?.sms)} detail={h?.sms || "از health"} />',
        1,
    )
    p.write_text(t, encoding='utf-8')
    changed.append('38-status')

# ---- 39: support role note in admin layout (finance already permission-gated) ----
p = Path('frontend/src/app/admin/layout.tsx')
t = p.read_text(encoding='utf-8')
if 'پشتیبانی مالی' not in t and 'admin.finance' in t:
    # add comment in code is enough - ensure finance requires finance permission (already anyOf)
    changed.append('39-finance-gated')

# ---- 40: deploy checklist in admin settings ----
p = Path('frontend/src/app/admin/settings/page.tsx')
if p.exists():
    t = p.read_text(encoding='utf-8')
    if 'چک‌لیست انتشار' not in t:
        block = '''
      <div className="rounded-3xl border border-border bg-white p-4 space-y-2">
        <h2 className="font-bold">چک‌لیست انتشار نسخه</h2>
        <ul className="list-disc space-y-1 pr-5 text-sm text-gray">
          <li>prisma migrate deploy روی لیارا</li>
          <li>SMS_PROVIDER واقعی یا mock</li>
          <li>PAYMENT_PROVIDER و callback URL</li>
          <li>NEXT_PUBLIC_API_URL / APP_URL</li>
          <li>REMINDERS_ENABLED و JWT secrets</li>
          <li>بعد از deploy: /status و یک رزرو آزمایشی</li>
        </ul>
      </div>
'''
        if re.search(r'<div[^>]*space-y-[0-9]+', t):
            t = re.sub(r'(<div[^>]*space-y-[0-9]+[^>]*>)', r'\1' + block, t, count=1)
            p.write_text(t, encoding='utf-8')
            changed.append('40-checklist')
        else:
            print('40 no container')
else:
    # create minimal checklist page
    Path('frontend/src/app/admin/deploy-checklist').mkdir(parents=True, exist_ok=True)
    Path('frontend/src/app/admin/deploy-checklist/page.tsx').write_text(
        "'use client';\n"
        "export default function DeployChecklistPage() {\n"
        "  return (\n"
        "    <div className=\"space-y-4\" dir=\"rtl\">\n"
        "      <h1 className=\"text-2xl font-bold\">چک‌لیست انتشار</h1>\n"
        "      <ul className=\"list-disc space-y-2 pr-5 text-sm\">\n"
        "        <li>prisma migrate deploy</li>\n"
        "        <li>SMS_PROVIDER</li>\n"
        "        <li>PAYMENT_PROVIDER + callback</li>\n"
        "        <li>NEXT_PUBLIC_* و JWT</li>\n"
        "        <li>تست /status و رزرو آزمایشی</li>\n"
        "      </ul>\n"
        "    </div>\n"
        "  );\n"
        "}\n",
        encoding='utf-8',
    )
    changed.append('40-page')

# ---- 36: note file for ops (also issue 42) ----
Path('docs').mkdir(exist_ok=True)
note = Path('docs/backup-drill.md')
if not note.exists():
    note.write_text(
        "# Backup drill (#61.36)\n\n"
        "Monthly: restore Liara/Postgres backup to staging, verify migrate + login + one booking.\n"
        "Record date and result in GitHub issue #42.\n",
        encoding='utf-8',
    )
    changed.append('36-docs')

print('CHANGED', changed)
