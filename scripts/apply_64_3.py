from pathlib import Path

# schema already restored by shell; ensure no_show in enum
schema_path = Path('backend/prisma/schema.prisma')
schema = schema_path.read_text()
if 'no_show' not in schema.split('enum BookingStatus')[1].split('}')[0]:
    schema = schema.replace(
        '  expired\n}',
        '  expired\n  no_show\n}',
        1,
    )
    schema_path.write_text(schema)
print('schema', schema_path.stat().st_size)

svc_path = Path('backend/src/bookings/bookings.service.ts')
t = svc_path.read_text()
assert 'class BookingsService' in t and 'PLACEHOLDER' not in t
idx = t.find("if (action === 'no_show')")
assert idx > 0, 'no_show block missing'
end = t.find("throw new BadRequestException('عملیات نامعتبر')", idx)
block = t[idx:end]
block2 = block.replace('status: BookingStatus.cancelled,', 'status: BookingStatus.no_show,', 1)
if '#64.3' not in block2:
    block2 = block2.replace(
        "if (action === 'no_show') {\n      if (!isPro)",
        "if (action === 'no_show') {\n      // #64.3 NEVER refund\n      if (!isPro)",
        1,
    )
t = t[:idx] + block2 + t[end:]
svc_path.write_text(t)
assert 'BookingStatus.no_show' in svc_path.read_text()
print('svc', svc_path.stat().st_size)

ctrl = Path('backend/src/bookings/bookings.controller.ts')
ct = ctrl.read_text()
ct = ct.replace(
    'Professional marks customer no-show (mapped to cancel with reason).',
    'Professional marks customer no-show (#64.3: status=no_show, never refund).',
)
ctrl.write_text(ct)

api = Path('frontend/src/lib/booking-api.ts')
a = api.read_text()
if 'no_show:' not in a:
    a = a.replace("completed: 'تکمیل شده',", "no_show: 'عدم حضور',\n    completed: 'تکمیل شده',")
    api.write_text(a)

zb = Path('frontend/src/app/zibagar/bookings/page.tsx')
z = zb.read_text()
if "value: 'no_show'" not in z:
    z = z.replace(
        "{ value: 'expired', label: 'منقضی' },",
        "{ value: 'expired', label: 'منقضی' },\n  { value: 'no_show', label: 'عدم حضور' },",
    )
z = z.replace(
    "st === 'cancelled' || st === 'rejected')",
    "st === 'cancelled' || st === 'rejected' || st === 'no_show')",
)
zb.write_text(z)
print('done')
