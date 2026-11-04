#!/usr/bin/env python3
"""#76 — separate no_show from cancel in data model and UI labels."""
from pathlib import Path


def patch_schema() -> None:
    path = Path('backend/prisma/schema.prisma')
    t = path.read_text()
    if 'noShowAt' in t:
        print('schema already has noShowAt')
        return
    old = '''  cancelledAt    DateTime?     @map("cancelled_at") @db.Timestamptz
  completedAt    DateTime?     @map("completed_at") @db.Timestamptz
'''
    new = '''  cancelledAt    DateTime?     @map("cancelled_at") @db.Timestamptz
  completedAt    DateTime?     @map("completed_at") @db.Timestamptz
  noShowAt       DateTime?     @map("no_show_at") @db.Timestamptz
  noShowReason   String?       @map("no_show_reason") @db.VarChar(255)
'''
    if old not in t:
        raise SystemExit('schema Booking fields not found')
    path.write_text(t.replace(old, new, 1))
    print('schema ok')


def patch_bookings_service() -> None:
    path = Path('backend/src/bookings/bookings.service.ts')
    t = path.read_text()
    old = '''    if (action === 'no_show') {
      if (!isPro) throw new ForbiddenException();
      const allowed: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];
      if (!allowed.includes(b.status)) {
        throw new BadRequestException('این رزرو قابل ثبت عدم حضور نیست');
      }
      return this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.no_show,
          cancelReason: reason || 'no_show',
          cancelledAt: new Date(),
        },
      });
    }
'''
    new = '''    if (action === 'no_show') {
      if (!isPro) throw new ForbiddenException();
      const allowed: BookingStatus[] = [BookingStatus.pending, BookingStatus.confirmed];
      if (!allowed.includes(b.status)) {
        throw new BadRequestException('این رزرو قابل ثبت عدم حضور نیست');
      }
      // #76 — no_show is not cancel; do not set cancelledAt/cancelReason
      return this.prisma.booking.update({
        where: { id },
        data: {
          status: BookingStatus.no_show,
          noShowAt: new Date(),
          noShowReason: reason?.trim() || null,
          cancelReason: null,
          cancelledAt: null,
        },
      });
    }
'''
    if old not in t:
        raise SystemExit('no_show transition block not found')
    path.write_text(t.replace(old, new, 1))
    print('bookings.service ok')


def patch_zibagar_timeline() -> None:
    path = Path('frontend/src/app/zibagar/bookings/page.tsx')
    t = path.read_text()
    old = '''  if (st === 'cancelled' || st === 'rejected' || st === 'no_show') {
    steps.push({ label: st === 'rejected' ? 'رد شد' : 'لغو شد', at: b.updatedAt });
'''
    new = '''  if (st === 'cancelled' || st === 'rejected' || st === 'no_show') {
    const endLabel =
      st === 'rejected' ? 'رد شد' : st === 'no_show' ? 'عدم حضور' : 'لغو شد';
    steps.push({ label: endLabel, at: b.updatedAt });
'''
    if old in t:
        t = t.replace(old, new, 1)
        path.write_text(t)
        print('zibagar timeline ok')
    else:
        print('WARN timeline pattern not found')


def patch_persian_status() -> None:
    path = Path('frontend/src/lib/persian-status.ts')
    t = path.read_text()
    # Ensure confirmed label is 'قطعی' optional; keep no_show distinct
    if "no_show: 'عدم حضور'" not in t:
        t = t.replace(
            "cancelled: 'لغو شده',",
            "cancelled: 'لغو شده',\n    no_show: 'عدم حضور',",
            1,
        )
        path.write_text(t)
        print('persian-status patched')
    else:
        print('persian-status already ok')


def patch_customer_bookings_if_needed() -> None:
    for rel in [
        'frontend/src/app/panel/bookings/page.tsx',
        'frontend/src/app/admin/bookings/page.tsx',
    ]:
        path = Path(rel)
        if not path.exists():
            continue
        t = path.read_text()
        changed = False
        if "st === 'no_show'" in t and "لغو شد" in t:
            # generic fix for similar ternary
            old = "st === 'rejected' ? 'رد شد' : 'لغو شد'"
            if old in t:
                t = t.replace(
                    old,
                    "st === 'rejected' ? 'رد شد' : st === 'no_show' ? 'عدم حضور' : 'لغو شد'",
                )
                changed = True
        if changed:
            path.write_text(t)
            print('fixed', rel)


if __name__ == '__main__':
    patch_schema()
    patch_bookings_service()
    patch_zibagar_timeline()
    patch_persian_status()
    patch_customer_bookings_if_needed()
