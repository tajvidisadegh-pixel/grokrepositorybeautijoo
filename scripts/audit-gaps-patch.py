from pathlib import Path
changed = []
p = Path("frontend/src/lib/panel-api.ts")
t = p.read_text(encoding="utf-8")
old = "export async function transitionBooking(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete', reason?: string) {\n  return apiClient.patch(`/bookings/${id}/${action}`, reason ? { reason } : undefined);\n}"
new = "export async function transitionBooking(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete' | 'no-show', reason?: string) {\n  return apiClient.patch(`/bookings/${id}/${action}`, reason ? { reason } : undefined);\n}"
if old in t:
    p.write_text(t.replace(old, new, 1), encoding="utf-8")
    changed.append("panel-api")
else:
    print("panel-api skip")

p = Path("frontend/src/app/zibagar/bookings/page.tsx")
t = p.read_text(encoding="utf-8")
old = "async function act(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete') {"
new = "async function act(id: string, action: 'confirm' | 'reject' | 'cancel' | 'complete' | 'no-show') {"
if old in t:
    t = t.replace(old, new, 1)
    changed.append("act-type")
if "'no-show'" not in t and "complete: 'رزرو به عنوان انجام‌شده ثبت شد.'" in t:
    t = t.replace(
        "complete: 'رزرو به عنوان انجام‌شده ثبت شد.',\n      };",
        "complete: 'رزرو به عنوان انجام‌شده ثبت شد.',\n        'no-show': 'عدم حضور مشتری ثبت شد.',\n      };",
        1,
    )
    changed.append("labels")

needle = """                              <Button
                                size=\"sm\"
                                loading={busy === `${b.id}:complete`}
                                onClick={() => act(b.id, 'complete')}
                              >
                                تکمیل
                              </Button>
                            </>
                          )}"""
# fixed below without over-escaping
print("partial")
print("CHANGED", changed)
