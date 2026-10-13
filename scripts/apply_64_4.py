from pathlib import Path

# admin bookings — restore content is done by git show in shell; we only patch
admin = Path('frontend/src/app/admin/bookings/page.tsx')
t = admin.read_text()
assert 'PLACEHOLDER' not in t and len(t) > 1000
if "value: 'no_show'" not in t:
    old = """const STATUS_OPTS = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'pending', label: 'در انتظار' },
  { value: 'confirmed', label: 'تأییدشده' },
  { value: 'completed', label: 'تکمیل‌شده' },
  { value: 'cancelled', label: 'لغوشده' },
  { value: 'rejected', label: 'ردشده' },
];"""
    new = """const STATUS_OPTS = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'pending', label: 'در انتظار' },
  { value: 'confirmed', label: 'تأییدشده' },
  { value: 'completed', label: 'تکمیل‌شده' },
  { value: 'cancelled', label: 'لغوشده' },
  { value: 'rejected', label: 'ردشده' },
  { value: 'expired', label: 'منقضی' },
  { value: 'no_show', label: 'عدم حضور' },
];"""
    if old not in t:
        raise SystemExit('admin STATUS_OPTS not found')
    t = t.replace(old, new, 1)
    admin.write_text(t)
print('admin ok', admin.stat().st_size)

panel = Path('frontend/src/app/panel/bookings/page.tsx')
t2 = panel.read_text()
assert len(t2) > 1000
if "v: 'no_show'" not in t2:
    old2 = """        {[
          { v: '', l: 'همه' },
          { v: 'pending', l: 'در انتظار' },
          { v: 'confirmed', l: 'تأییدشده' },
          { v: 'completed', l: 'انجام‌شده' },
          { v: 'cancelled', l: 'کنسل‌شده' },
        ].map((o) => ("""
    new2 = """        {[
          { v: '', l: 'همه' },
          { v: 'pending', l: 'در انتظار' },
          { v: 'confirmed', l: 'تأییدشده' },
          { v: 'completed', l: 'انجام‌شده' },
          { v: 'cancelled', l: 'کنسل‌شده' },
          { v: 'no_show', l: 'عدم حضور' },
          { v: 'expired', l: 'منقضی' },
        ].map((o) => ("""
    if old2 not in t2:
        raise SystemExit('panel filter not found')
    t2 = t2.replace(old2, new2, 1)
if "st === 'cancelled' || st === 'rejected')" in t2:
    t2 = t2.replace(
        "if (st === 'cancelled' || st === 'rejected') {\n    steps.push({ label: st === 'rejected' ? 'رد شد' : 'لغو شد', at: b.updatedAt });",
        "if (st === 'cancelled' || st === 'rejected' || st === 'no_show') {\n    steps.push({ label: st === 'rejected' ? 'رد شد' : st === 'no_show' ? 'عدم حضور' : 'لغو شد', at: b.updatedAt });",
        1,
    )
panel.write_text(t2)
print('panel ok', panel.stat().st_size)
print('done')
