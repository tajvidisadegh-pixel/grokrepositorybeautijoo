from pathlib import Path
import re

# ========== 41: effectiveBookingStatus (time-based in_progress) ==========
p = Path("frontend/src/lib/persian-status.ts")
t = p.read_text()
if "effectiveBookingStatus" not in t:
    t = t.replace(
        "pending: 'در انتظار تأیید',\n    confirmed: 'تأیید شده',",
        "pending: 'در انتظار تأیید',\n    confirmed: 'تأیید شده',\n    in_progress: 'در حال انجام',",
    )
    helper = """

/** Display status: confirmed bookings within [startAt, endAt] show as in_progress. */
export function effectiveBookingStatus(b: {
  status?: string | null;
  startAt?: string | null;
  endAt?: string | null;
}): string {
  const st = (b.status || '').toLowerCase();
  if (st !== 'confirmed') return st || '';
  if (!b.startAt) return st;
  const now = Date.now();
  const start = new Date(b.startAt).getTime();
  const end = b.endAt ? new Date(b.endAt).getTime() : start + 60 * 60 * 1000;
  if (Number.isFinite(start) && Number.isFinite(end) && now >= start && now < end) {
    return 'in_progress';
  }
  return st;
}
"""
    t = t.rstrip() + "\n" + helper + "\n"
    p.write_text(t)
    print("41 persian-status OK")
else:
    print("41 skip")

for path in [
    "frontend/src/app/zibagar/bookings/page.tsx",
    "frontend/src/app/panel/bookings/page.tsx",
]:
    pp = Path(path)
    if not pp.exists():
        print(path, "missing")
        continue
    tt = pp.read_text()
    if "effectiveBookingStatus" in tt:
        print(path, "already")
        continue
    if "persianBookingStatus" in tt:
        tt = tt.replace(
            "import { persianBookingStatus } from '@/lib/persian-status';",
            "import { persianBookingStatus, effectiveBookingStatus } from '@/lib/persian-status';",
        )
        tt = tt.replace(
            "persianBookingStatus(b.status)",
            "persianBookingStatus(effectiveBookingStatus(b))",
        )
        pp.write_text(tt)
        print(path, "wired")
    else:
        print(path, "no persian import")

# ========== 42: portfolio max count messaging ==========
p42 = Path("frontend/src/app/zibagar/portfolio/page.tsx")
t42 = p42.read_text()
if "MAX_PORTFOLIO" not in t42:
    t42 = t42.replace(
        "const MAX_VIDEO_SEC = 60;",
        "const MAX_VIDEO_SEC = 60;\nconst MAX_PORTFOLIO = 40;",
    )
    old_sub = "تصویر تا ۱۰ مگ · ویدیو تا ۵۰۰ مگ (حداکثر ۱ دقیقه)"
    new_sub = "تصویر تا ۱۰ مگ · ویدیو تا ۵۰۰ مگ (حداکثر ۱ دقیقه) · حداکثر ۴۰ مورد"
    if old_sub in t42:
        t42 = t42.replace(old_sub, new_sub)
    marker = "setBusy(true);\n    setUploadProgress(0);\n    setMsg(null);"
    inject = (
        "if (items.length >= MAX_PORTFOLIO) {\n"
        "      setMsg(`سقف تعداد نمونه\u200cکار (${MAX_PORTFOLIO}) پر است. ابتدا موردی را حذف کنید.`);\n"
        "      return;\n"
        "    }\n"
        "    setBusy(true);\n"
        "    setUploadProgress(0);\n"
        "    setMsg(null);"
    )
    if marker in t42:
        t42 = t42.replace(marker, inject, 1)
        print("42 block OK")
    else:
        print("42 block marker missing")
    title_block = '<h1 className="text-2xl font-bold">پورتفولیو</h1>'
    if title_block in t42:
        t42 = t42.replace(
            title_block,
            '<h1 className="text-2xl font-bold">پورتفولیو <span className="text-base font-normal text-gray">({items.length}/{MAX_PORTFOLIO})</span></h1>',
        )
        print("42 count badge OK")
    p42.write_text(t42)
    print("42 portfolio OK")
else:
    print("42 skip")

# ========== 43: success messages on zibagar booking actions ==========
p43 = Path("frontend/src/app/zibagar/bookings/page.tsx")
t43 = p43.read_text()
if "setActionMsg" not in t43 and "رزرو با موفقیت تأیید شد" not in t43:
    if "const [reportMsg, setReportMsg] = useState<string | null>(null);" in t43:
        t43 = t43.replace(
            "const [reportMsg, setReportMsg] = useState<string | null>(null);",
            "const [reportMsg, setReportMsg] = useState<string | null>(null);\n  const [actionMsg, setActionMsg] = useState<string | null>(null);",
        )
    old_act = """  async function act(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete') {
    setBusy(`${id}:${action}`);
    setError(null);
    try {
      let reason: string | undefined;
      if (action === 'reject') {
        reason = window.prompt('دلیل رد (اختیاری):') || undefined;
      }
      await transitionBooking(id, action, reason);
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(null);
    }
  }"""
    new_act = """  async function act(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete') {
    setBusy(`${id}:${action}`);
    setError(null);
    setActionMsg(null);
    try {
      let reason: string | undefined;
      if (action === 'reject') {
        reason = window.prompt('دلیل رد (اختیاری):') || undefined;
      }
      await transitionBooking(id, action, reason);
      const labels: Record<string, string> = {
        confirm: 'رزرو با موفقیت تأیید شد.',
        reject: 'رزرو رد شد.',
        cancel: 'رزرو لغو شد.',
        complete: 'رزرو به عنوان انجام\u200cشده ثبت شد.',
      };
      setActionMsg(labels[action] || 'عملیات با موفقیت انجام شد.');
      await load();
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(null);
    }
  }"""
    if old_act in t43:
        t43 = t43.replace(old_act, new_act)
        print("43 act OK")
    else:
        print("43 act marker mismatch")
    if "{reportMsg && (" in t43:
        t43 = t43.replace(
            "{reportMsg && (",
            "{actionMsg && (\n        <p className=\"rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800\">{actionMsg}</p>\n      )}\n      {reportMsg && (",
            1,
        )
        print("43 banner OK")
    p43.write_text(t43)
else:
    print("43 skip")

# ========== 45: report on customer panel bookings ==========
p45 = Path("frontend/src/app/panel/bookings/page.tsx")
t45 = p45.read_text()
if "reportBookingToAdmin" not in t45:
    if "transitionBooking" in t45:
        t45 = t45.replace(
            "transitionBooking",
            "transitionBooking,\n  reportBookingToAdmin",
            1,
        )
        print("45 import OK")
    if "const [reviewMsg, setReviewMsg] = useState<string | null>(null);" in t45:
        t45 = t45.replace(
            "const [reviewMsg, setReviewMsg] = useState<string | null>(null);",
            "const [reviewMsg, setReviewMsg] = useState<string | null>(null);\n  const [reportFor, setReportFor] = useState<string | null>(null);\n  const [reportText, setReportText] = useState('');\n  const [reportMsg, setReportMsg] = useState<string | null>(null);",
        )
        print("45 state OK")
    elif "const [actionMsg, setActionMsg] = useState<string | null>(null);" in t45:
        t45 = t45.replace(
            "const [actionMsg, setActionMsg] = useState<string | null>(null);",
            "const [actionMsg, setActionMsg] = useState<string | null>(null);\n  const [reportFor, setReportFor] = useState<string | null>(null);\n  const [reportText, setReportText] = useState('');\n  const [reportMsg, setReportMsg] = useState<string | null>(null);",
        )
        print("45 state via actionMsg OK")

    insert_fn = """
  async function submitReport(id: string) {
    setBusy(`${id}:report`);
    setReportMsg(null);
    setError(null);
    try {
      await reportBookingToAdmin(id, reportText.trim());
      setReportMsg('گزارش برای پشتیبانی ارسال شد.');
      setReportFor(null);
      setReportText('');
    } catch (e) {
      setError(friendlyApiError(e));
    } finally {
      setBusy(null);
    }
  }

"""
    if "async function submitReport" not in t45:
        idx = t45.find("async function ")
        if idx > 0:
            t45 = t45[:idx] + insert_fn + t45[idx:]
            print("45 fn OK")

    if "گزارش مشکل" not in t45:
        if "actionMsg &&" in t45:
            t45 = t45.replace(
                "{actionMsg &&",
                "{reportMsg && (\n        <p className=\"rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800\">{reportMsg}</p>\n      )}\n      {actionMsg &&",
                1,
            )
        contact_marker = "تماس با زیباگر"
        cpos = t45.find(contact_marker)
        report_ui = """
              <div className="mt-2">
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
                  <div className="mt-2 space-y-2 rounded-xl border border-border bg-muted/40 p-3">
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
                      disabled={reportText.trim().length < 5 || busy === `${b.id}:report`}
                      onClick={() => void submitReport(b.id)}
                    >
                      ارسال گزارش
                    </button>
                  </div>
                )}
              </div>
"""
        if cpos > 0:
            end = t45.find(") : null}", cpos)
            if end > 0:
                end = t45.find("\n", end) + 1
                t45 = t45[:end] + report_ui + t45[end:]
                print("45 UI OK")
            else:
                print("45 contact end missing")
        else:
            alt = "persianBookingStatus(effectiveBookingStatus(b))"
            if alt not in t45:
                alt = "persianBookingStatus(b.status)"
            apos = t45.find(alt)
            if apos > 0:
                line_end = t45.find("\n", apos)
                t45 = t45[: line_end + 1] + report_ui + t45[line_end + 1 :]
                print("45 UI alt OK")
            else:
                print("45 UI place missing")
    p45.write_text(t45)
    print("45 panel report done")
else:
    print("45 skip")

print("DONE ALL 41-45")
