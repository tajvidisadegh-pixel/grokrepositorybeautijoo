#!/usr/bin/env python3
from pathlib import Path
import runpy

# Run original if needed
runpy.run_path('scripts/patch-reschedule.py')

p = Path('backend/src/bookings/bookings.service.ts')
s = p.read_text()
old = '''      const slots = await this.availability.getSlots(
        b.professionalId,
        dateStr,
        durationMin,
      );
      const hhmm = tehranHHMM(startAt);
      const ok = (slots || []).some(
        (s: { start?: string }) => s.start === hhmm || s.start === hhmm.slice(0, 5),
      );'''
new = '''      const avail = await this.availability.getSlots(
        b.professionalId,
        dateStr,
        durationMin,
      );
      const slotList = Array.isArray(avail)
        ? avail
        : Array.isArray((avail as { slots?: unknown })?.slots)
          ? (avail as { slots: { start?: string; available?: boolean }[] }).slots
          : [];
      const hhmm = tehranHHMM(startAt);
      const ok = slotList.some(
        (s) =>
          s.available !== false &&
          (s.start === hhmm || s.start === hhmm.slice(0, 5)),
      );'''
if old in s:
    p.write_text(s.replace(old, new, 1))
    print('slots type fixed')
elif 'const slotList = Array.isArray(avail)' in s:
    print('slots already fixed')
else:
    print('warn: slots block not found (maybe already different)')
