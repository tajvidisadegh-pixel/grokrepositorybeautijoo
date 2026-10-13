from pathlib import Path

admin = Path('frontend/src/app/admin/bookings/page.tsx')
t = admin.read_text()
assert 'PLACEHOLDER' not in t and 'STATUS_OPTS' in t
if "value: 'no_show'" not in t:
    needle = "{ value: 'rejected', label:"
    idx = t.find(needle)
    if idx < 0:
        raise SystemExit('rejected option not found')
    end = t.find('\n', idx)
    line = t[idx:end]
    insert = line + "\n  { value: 'expired', label: 'منقضی' },\n  { value: 'no_show', label: 'عدم حضور' },"
    t = t[:idx] + insert + t[end:]
    admin.write_text(t)
    print('admin patched')
else:
    print('admin already has no_show')
print('admin size', admin.stat().st_size)
assert "value: 'no_show'" in admin.read_text()
print('ok')
