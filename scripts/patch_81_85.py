from pathlib import Path

changed = []

def patch_notif(rel):
    p = Path(rel)
    if not p.exists():
        return
    t = p.read_text(encoding="utf-8")
    if "notifKindLabel" in t:
        print(rel, "exists")
        return
    helper = (
        "\nfunction notifKindLabel(type?: string | null, title?: string | null): "
        "{ label: string; className: string } {\n"
        "  const s = `${type || ''} ${title || ''}`.toLowerCase();\n"
        "  if (/book|\u0631\u0632\u0631\u0648|\u0646\u0648\u0628\u062a|payment|\u067e\u0631\u062f\u0627\u062e\u062a|confirm|reject|cancel|\u0644\u063a\u0648/.test(s)) {\n"
        "    return { label: '\u0631\u0632\u0631\u0648', className: 'bg-coral-soft text-coral' };\n"
        "  }\n"
        "  if (/system|\u0633\u06cc\u0633\u062a\u0645|security|welcome|otp|verify/.test(s)) {\n"
        "    return { label: '\u0633\u06cc\u0633\u062a\u0645\u06cc', className: 'bg-gray-light text-gray' };\n"
        "  }\n"
        "  return { label: '\u0639\u0645\u0648\u0645\u06cc', className: 'bg-blue-light text-blue' };\n"
        "}\n"
    )
    if "export default function" in t:
        t = t.replace("export default function", helper + "\nexport default function", 1)
    old = "<p className=\"font-semibold\">{n.title || n.type || '\u0627\u0639\u0644\u0627\u0646'}</p>"
    if old in t:
        new = (
            "<div className=\"flex flex-wrap items-center gap-2\">\n"
            "                          <p className=\"font-semibold\">{n.title || n.type || '\u0627\u0639\u0644\u0627\u0646'}</p>\n"
            "                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${notifKindLabel(n.type, n.title).className}`}>\n"
            "                            {notifKindLabel(n.type, n.title).label}\n"
            "                          </span>\n"
            "                        </div>"
        )
        t = t.replace(old, new, 1)
    p.write_text(t, encoding="utf-8")
    changed.append("81-" + rel)

patch_notif("frontend/src/app/panel/notifications/page.tsx")
patch_notif("frontend/src/app/zibagar/notifications/page.tsx")

p = Path("frontend/src/app/zibagar/profile/page.tsx")
t = p.read_text(encoding="utf-8")
if "\u0642\u0628\u0644 \u0627\u0632 \u0627\u0646\u062a\u0634\u0627\u0631\u060c \u067e\u06cc\u0634\u200c\u0646\u0645\u0627\u06cc\u0634" not in t:
    if "\u0627\u0637\u0644\u0627\u0639\u0627\u062a \u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u06a9\u0627\u0645\u0644 \u0627\u0633\u062a" in t:
        t = t.replace(
            "\u0627\u0637\u0644\u0627\u0639\u0627\u062a \u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u06a9\u0627\u0645\u0644 \u0627\u0633\u062a",
            "\u0627\u0637\u0644\u0627\u0639\u0627\u062a \u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u06a9\u0627\u0645\u0644 \u0627\u0633\u062a \u2014 \u0642\u0628\u0644 \u0627\u0632 \u0627\u0646\u062a\u0634\u0627\u0631 \u062d\u062a\u0645\u0627\u064b \u067e\u06cc\u0634\u200c\u0646\u0645\u0627\u06cc\u0634 \u0631\u0627 \u0628\u0628\u06cc\u0646\u06cc\u062f",
            1,
        )
        changed.append("82")
    p.write_text(t, encoding="utf-8")

p = Path("frontend/src/app/zibagar/hours/page.tsx")
t = p.read_text(encoding="utf-8")
if "\u062a\u062f\u0627\u062e\u0644" not in t and "addTimeOff" in t:
    needle = "await addTimeOff({\n                      ...tehranRange(blockDate, blockFrom, blockTo),"
    if needle in t:
        repl = (
            "const range = tehranRange(blockDate, blockFrom, blockTo);\n"
            "                    const rs = new Date(range.startAt).getTime();\n"
            "                    const re = new Date(range.endAt).getTime();\n"
            "                    const conflicts = bookings.filter((b) => {\n"
            "                      const st = String(b.status || '');\n"
            "                      if (st === 'cancelled' || st === 'rejected') return false;\n"
            "                      const bs = new Date(b.startAt).getTime();\n"
            "                      const be = b.endAt ? new Date(b.endAt).getTime() : bs + 3600000;\n"
            "                      return bs < re && be > rs;\n"
            "                    });\n"
            "                    if (conflicts.length > 0) {\n"
            "                      const ok = window.confirm(\n"
            "                        `\u0627\u06cc\u0646 \u0628\u0627\u0632\u0647 \u0628\u0627 ${conflicts.length.toLocaleString('fa-IR')} \u0646\u0648\u0628\u062a \u062a\u062f\u0627\u062e\u0644 \u062f\u0627\u0631\u062f. \u0627\u062f\u0627\u0645\u0647 \u0645\u06cc\u200c\u062f\u0647\u06cc\u062f\u061f`,\n"
            "                      );\n"
            "                      if (!ok) { setSubmitting(false); return; }\n"
            "                    }\n"
            "                    await addTimeOff({\n"
            "                      ...range,"
        )
        t = t.replace(needle, repl, 1)
        p.write_text(t, encoding="utf-8")
        changed.append("83")
    else:
        print("83 miss")
else:
    print("83 skip")

changed.append("84-ok")

p = Path("backend/src/admin/admin.controller.ts")
t = p.read_text(encoding="utf-8")
old = "  deleteReview(@Param('id') id: string, @CurrentUser('id') actorId?: string) {\n    return this.service.deleteReview(id, actorId);\n  }"
new = (
    "  deleteReview(\n"
    "    @Param('id') id: string,\n"
    "    @CurrentUser('id') actorId?: string,\n"
    "    @Query('reason') reason?: string,\n"
    "  ) {\n"
    "    return this.service.deleteReview(id, actorId, reason);\n"
    "  }"
)
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
if "\u062f\u0644\u06cc\u0644 \u062d\u0630\u0641" not in t:
    if "await apiClient.delete(`/admin/reviews/${id}`)" in t:
        if "async function remove(id: string)" in t:
            t = t.replace(
                "async function remove(id: string) {",
                "async function remove(id: string) {\n"
                "    const reason = window.prompt('\u062f\u0644\u06cc\u0644 \u062d\u0630\u0641 \u0646\u0638\u0631 \u0631\u0627 \u0628\u0646\u0648\u06cc\u0633\u06cc\u062f:');\n"
                "    if (reason == null || !String(reason).trim()) return;",
                1,
            )
        t = t.replace(
            "await apiClient.delete(`/admin/reviews/${id}`);",
            "await apiClient.delete(`/admin/reviews/${id}?reason=${encodeURIComponent(String(reason).trim().slice(0, 500))}`);",
            1,
        )
        p.write_text(t, encoding="utf-8")
        changed.append("85-ui")

print("CHANGED", changed)
