from pathlib import Path
import re

changed = []

# ---- 81: notification labels (booking vs system) ----
for rel in [
    "frontend/src/app/panel/notifications/page.tsx",
    "frontend/src/app/zibagar/notifications/page.tsx",
]:
    p = Path(rel)
    if not p.exists():
        continue
    t = p.read_text(encoding="utf-8")
    if "notifKindLabel" in t:
        print(rel, "81 exists")
        continue
    helper = '''
function notifKindLabel(type?: string | null, title?: string | null): { label: string; className: string } {
  const s = `${type || ''} ${title || ''}`.toLowerCase();
  if (/book|رزرو|نوبت|payment|پرداخت|confirm|reject|cancel|لغو|تأیید|رد/.test(s)) {
    return { label: 'رزرو', className: 'bg-coral-soft text-coral' };
  }
  if (/system|سیستم|security|امنیت|welcome|خوش|otp|verify/.test(s)) {
    return { label: 'سیستمی', className: 'bg-gray-light text-gray' };
  }
  return { label: 'عمومی', className: 'bg-blue-light text-blue' };
}
'''
    if "export default function" in t:
        t = t.replace("export default function", helper + "\nexport default function", 1)
    old = "<p className=\"font-semibold\">{n.title || n.type || 'اعلان'}</p>"
    if old in t:
        new = """<div className=\"flex flex-wrap items-center gap-2\">
                          <p className=\"font-semibold\">{n.title || n.type || 'اعلان'}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${notifKindLabel(n.type, n.title).className}`}>
                            {notifKindLabel(n.type, n.title).label}
                          </span>
                        </div>"""
        t = t.replace(old, new, 1)
    p.write_text(t, encoding="utf-8")
    changed.append("81-" + rel.split("/")[3])

# ---- 82: preview before publish ----
p = Path("frontend/src/app/zibagar/profile/page.tsx")
t = p.read_text(encoding="utf-8")
if "قبل از انتشار، پیش‌نمایش" not in t:
    old = """<Button size=\"sm\" onClick={() => setConfirm(true)}>
                انتشار پروفایل
              </Button>"""
    if old in t:
        t = t.replace(
            old,
            old
            + """
              <Link href=\"/zibagar/profile/preview\">
                <Button size=\"sm\" variant=\"outline\">قبل از انتشار، پیش‌نمایش ببینید</Button>
              </Link>""",
            1,
        )
        changed.append("82")
    elif "اطلاعات پروفایل کامل است" in t:
        t = t.replace(
            "اطلاعات پروفایل کامل است",
            "اطلاعات پروفایل کامل است — قبل از انتشار حتماً پیش‌نمایش را ببینید",
            1,
        )
        changed.append("82-hint")
    p.write_text(t, encoding="utf-8")

# ---- 83: time-off conflict ----
p = Path("frontend/src/app/zibagar/hours/page.tsx")
t = p.read_text(encoding="utf-8")
if "تداخل" not in t and "addTimeOff" in t:
    needle = "await addTimeOff({\n                      ...tehranRange(blockDate, blockFrom, blockTo),"
    if needle in t:
        t = t.replace(
            needle,
            """const range = tehranRange(blockDate, blockFrom, blockTo);
                    const rs = new Date(range.startAt).getTime();
                    const re = new Date(range.endAt).getTime();
                    const conflicts = bookings.filter((b) => {
                      const st = String(b.status || '');
                      if (st === 'cancelled' || st === 'rejected') return false;
                      const bs = new Date(b.startAt).getTime();
                      const be = b.endAt ? new Date(b.endAt).getTime() : bs + 3600000;
                      return bs < re && be > rs;
                    });
                    if (conflicts.length > 0) {
                      const ok = window.confirm(
                        `این بازه با ${conflicts.length.toLocaleString('fa-IR')} نوبت تداخل دارد. ادامه می‌دهید؟`,
                      );
                      if (!ok) { setSubmitting(false); return; }
                    }
                    await addTimeOff({
                      ...range,"",
            1,
        )
        p.write_text(t, encoding="utf-8")
        changed.append("83")
    else:
        print("83 miss")
else:
    print("83 skip")

changed.append("84-ok")

# ---- 85 backend ----
p = Path("backend/src/admin/admin.controller.ts")
t = p.read_text(encoding="utf-8")
old = """  deleteReview(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.service.deleteReview(id, actorId);
  }"""
new = """  deleteReview(
    @Param('id') id: string,
    @CurrentUser('id') actorId?: string,
    @Query('reason') reason?: string,
  ) {
    return this.service.deleteReview(id, actorId, reason);
  }"""
if old in t:
    t = t.replace(old, new, 1)
    p.write_text(t, encoding="utf-8")
    changed.append("85-ctrl")

p = Path("backend/src/admin/admin.service.ts")
t = p.read_text(encoding="utf-8")
if "async deleteReview(id: string, actorId?: string)" in t:
    t = t.replace(
        "async deleteReview(id: string, actorId?: string) {",
        "async deleteReview(id: string, actorId?: string, reason?: string) {",
        1,
    )
    t = t.replace(
        "await this.audit(actorId, 'review.delete', 'review', id, existing, null);",
        "await this.audit(actorId, 'review.delete', 'review', id, { ...existing, deleteReason: reason || null }, null);",
        1,
    )
    p.write_text(t, encoding="utf-8")
    changed.append("85-svc")

p = Path("frontend/src/app/admin/reviews/page.tsx")
t = p.read_text(encoding="utf-8")
if "دلیل حذف" not in t:
    if "await apiClient.delete(`/admin/reviews/${id}`)" in t:
        t = t.replace(
            "if (!confirm('آیا از حذف این نظر مطمئن هستید؟')) return;",
            "if (!confirm('آیا از حذف این نظر مطمئن هستید؟')) return;\n"
            "    const reason = window.prompt('دلیل حذف نظر را بنویسید (برای پیگیری):');\n"
            "    if (reason == null) return;\n"
            "    if (!reason.trim()) { setMsg('دلیل حذف الزامی است.'); return; }",
            1,
        )
        t = t.replace(
            "await apiClient.delete(`/admin/reviews/${id}`);",
            "await apiClient.delete(`/admin/reviews/${id}?reason=${encodeURIComponent(reason.trim().slice(0, 500))}`);",
            1,
        )
        p.write_text(t, encoding="utf-8")
        changed.append("85-ui")

print("CHANGED", changed)
