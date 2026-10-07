from pathlib import Path

p = Path('frontend/src/app/panel/bookings/page.tsx')
t = p.read_text()

# 1) Fix import
old_imp = "import { persianBookingStatus, persianPaymentStatus } from '@/lib/persian-status';"
new_imp = "import { persianBookingStatus, persianPaymentStatus, effectiveBookingStatus } from '@/lib/persian-status';"
if old_imp in t:
    t = t.replace(old_imp, new_imp)
    print('import OK')
elif 'effectiveBookingStatus' in t:
    print('import already')
else:
    print('import marker missing')

# 2) Fix submitReport to use setSubmitting
t = t.replace('setBusy(`${id}:report`);', 'setSubmitting(true);')
t = t.replace('setBusy(null);', 'setSubmitting(false);')
print('busy->submitting OK')

# 3) Fix busy reference in button disabled
t = t.replace(
    "disabled={reportText.trim().length < 5 || busy === `${b.id}:report`}",
    "disabled={reportText.trim().length < 5 || submitting}",
)
print('disabled OK')

# 4) Fix broken JSX: contact+report were inserted inside status span.
# Replace the entire broken block with a clean structure.
broken_start = "                    <div className=\"flex flex-col items-end gap-1\">"
# Find the status section and rebuild it cleanly

# Pattern: from contact block wrongly inside span through closing span
import re

# Replace the malformed status column
pat = re.compile(
    r'<div className="flex flex-col items-end gap-1">\s*'
    r'<span className="rounded-full bg-coral-soft px-3 py-1 text-xs font-medium text-coral">\s*'
    r'\{\(\(b\.status === \'confirmed\'.*?\) : null\}\s*'
    r'<div className="mt-2">.*?</div>\s*'
    r'\{persianBookingStatus\(effectiveBookingStatus\(b\)\)\}\s*'
    r'</span>',
    re.DOTALL,
)

replacement = '''<div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-coral-soft px-3 py-1 text-xs font-medium text-coral">
                        {persianBookingStatus(effectiveBookingStatus(b))}
                      </span>
                      {((b.status === 'confirmed' || b.status === 'completed') &&
                        (b.professional as { user?: { phone?: string | null } } | undefined)?.user?.phone) ? (
                        <a
                          href={`tel:${(b.professional as { user?: { phone?: string | null } }).user!.phone}`}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-coral hover:text-coral-dark"
                          dir="ltr"
                        >
                          تماس با زیباگر: {(b.professional as { user?: { phone?: string | null } }).user!.phone}
                        </a>
                      ) : null}
                      <div className="mt-1">
                        <button
                          type="button"
                          className="text-xs text-gray-muted hover:text-coral"
                          onClick={() => {
                            setReportFor(reportFor === b.id ? null : b.id);
                            setReportText('');
                          }}
                        >
                          گزارش مشکل
                        </button>
                        {reportFor === b.id && (
                          <div className="mt-2 space-y-2 rounded-xl border border-border bg-muted/40 p-3 text-start">
                            <textarea
                              className="w-full rounded-lg border border-border bg-white p-2 text-xs"
                              rows={3}
                              placeholder="توضیح مشکل (حداقل ۵ کاراکتر)"
                              value={reportText}
                              onChange={(e) => setReportText(e.target.value)}
                            />
                            <button
                              type="button"
                              className="rounded-lg bg-coral px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                              disabled={reportText.trim().length < 5 || submitting}
                              onClick={() => void submitReport(b.id)}
                            >
                              ارسال گزارش
                            </button>
                          </div>
                        )}
                      </div>'''

m = pat.search(t)
if m:
    t = t[:m.start()] + replacement + t[m.end():]
    print('JSX structure OK')
else:
    print('JSX pattern not matched - trying simpler')
    # If already fixed or different, ensure effectiveBookingStatus is used
    if 'persianBookingStatus(b.status)' in t:
        t = t.replace('persianBookingStatus(b.status)', 'persianBookingStatus(effectiveBookingStatus(b))')
        print('status call fixed')

p.write_text(t)
print('DONE')
