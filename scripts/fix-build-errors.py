#!/usr/bin/env python3
"""Fix TypeScript build errors in availability.service and bookings.service."""
from pathlib import Path

# --- timezone: add tehranWeekdaySun0 ---
tz = Path("backend/src/common/timezone.ts")
t = tz.read_text(encoding="utf-8")
if "tehranWeekdaySun0" not in t:
    t = t.rstrip() + """

/** Weekday in Asia/Tehran for YYYY-MM-DD: 0=Sunday … 6=Saturday. */
export function tehranWeekdaySun0(dateStr: string): number {
  return tehranDayBounds(dateStr).dayOfWeek;
}
"""
    tz.write_text(t + "\n", encoding="utf-8")
    print("timezone: added tehranWeekdaySun0")
else:
    print("timezone: ok")

# --- availability.service.ts rewrite against real schema ---
avail_path = Path("backend/src/availability/availability.service.ts")
avail = r'''import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, DayOfWeek } from '@prisma/client';
import { TEHRAN_TZ, tehranLocalToUtc, tehranWeekdaySun0 } from '../common/timezone';

function parseTime(t: string): number {
  const parts = String(t || '').trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new BadRequestException('invalid time');
  }
  return h * 60 + m;
}

function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Map Sun0 weekday to Prisma DayOfWeek enum. */
function toDayOfWeek(sun0: number): DayOfWeek {
  const map: DayOfWeek[] = [
    DayOfWeek.sunday,
    DayOfWeek.monday,
    DayOfWeek.tuesday,
    DayOfWeek.wednesday,
    DayOfWeek.thursday,
    DayOfWeek.friday,
    DayOfWeek.saturday,
  ];
  return map[((sun0 % 7) + 7) % 7];
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public availability slots for a professional on a given Tehran calendar date.
   * Returns only available slots (busy windows are not exposed).
   */
  async getSlots(
    professionalId: string,
    dateStr: string,
    durationMin = 30,
    bufferMin = 0,
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    const pro = await this.prisma.professional.findUnique({ where: { id: professionalId } });
    if (!pro || pro.status !== 'approved') throw new NotFoundException('\u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');

    const dayOfWeek = toDayOfWeek(tehranWeekdaySun0(dateStr));
    const hours = await this.prisma.workingHour.findMany({
      where: { professionalId, dayOfWeek, isActive: true, isClosed: false },
      include: { breaks: true },
    });
    if (!hours.length) {
      return { date: dateStr, professionalId, durationMin, slots: [] as { start: string; end: string; available: boolean }[], timezone: TEHRAN_TZ };
    }

    const dayStart = tehranLocalToUtc(dateStr, '00:00');
    const dayEnd = tehranLocalToUtc(dateStr, '23:59');

    const [bookings, timeOffs, manuals] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          professionalId,
          status: { in: [BookingStatus.pending, BookingStatus.confirmed] },
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
        select: { startAt: true, endAt: true },
      }),
      this.prisma.timeOff.findMany({
        where: {
          professionalId,
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
        select: { startAt: true, endAt: true },
      }),
      this.prisma.manualReservation.findMany({
        where: {
          professionalId,
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
        select: { startAt: true, endAt: true },
      }),
    ]);

    const trailingBuffer = Math.max(0, bufferMin || 0);
    const step = 15;
    const slots: { start: string; end: string; available: boolean }[] = [];

    const now = new Date();
    const nowTehran = new Intl.DateTimeFormat('en-GB', {
      timeZone: TEHRAN_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const part = (t: string) => nowTehran.find((p) => p.type === t)?.value || '0';
    const todayStr = `${part('year')}-${part('month')}-${part('day')}`;
    const nowMins =
      todayStr === dateStr ? parseInt(part('hour'), 10) * 60 + parseInt(part('minute'), 10) : -1;

    type Range = { start: number; end: number };
    const toRange = (b: { startAt: Date; endAt: Date }): Range => ({
      start: Math.floor((b.startAt.getTime() - dayStart.getTime()) / 60000),
      end: Math.ceil((b.endAt.getTime() - dayStart.getTime()) / 60000),
    });

    const busy: Range[] = [
      ...bookings.map(toRange),
      ...timeOffs.map(toRange),
      ...manuals.map(toRange),
    ];

    for (const wh of hours) {
      const whStart = parseTime(wh.startTime);
      const whEnd = parseTime(wh.endTime);
      const breakRanges: Range[] = (wh.breaks || []).map((b) => ({
        start: parseTime(b.startTime),
        end: parseTime(b.endTime),
      }));

      for (let t = whStart; t + durationMin <= whEnd; t += step) {
        if (nowMins >= 0 && t < nowMins) continue;

        const slotEnd = t + durationMin;
        const slotBusyEnd = slotEnd + trailingBuffer;
        const inBreak = breakRanges.some((b) => t < b.end && slotEnd > b.start);
        const inBusy = busy.some((b) => t < b.end && slotBusyEnd > b.start);
        const available = !inBreak && !inBusy;
        slots.push({
          start: formatTime(t),
          end: formatTime(slotEnd),
          available,
        });
      }
    }

    const publicSlots = slots.filter((s) => s.available);
    return {
      date: dateStr,
      professionalId,
      durationMin,
      slots: publicSlots,
      timezone: TEHRAN_TZ,
    };
  }

  static tehranLocalToUtc(dateStr: string, hhmm: string): Date {
    return tehranLocalToUtc(dateStr, hhmm);
  }
}
'''
avail_path.write_text(avail, encoding="utf-8")
print("availability rewritten")

# --- bookings.service.ts: fix includes typing ---
bp = Path("backend/src/bookings/bookings.service.ts")
bt = bp.read_text(encoding="utf-8")
old1 = "if (![BookingStatus.pending, BookingStatus.confirmed].includes(existing.status))"
new1 = "if (!([BookingStatus.pending, BookingStatus.confirmed] as BookingStatus[]).includes(existing.status))"
old2 = "if (![BookingStatus.pending, BookingStatus.confirmed].includes(b.status))"
new2 = "if (!([BookingStatus.pending, BookingStatus.confirmed] as BookingStatus[]).includes(b.status))"
n = 0
if old1 in bt:
    bt = bt.replace(old1, new1)
    n += 1
if old2 in bt:
    bt = bt.replace(old2, new2)
    n += 1
bp.write_text(bt, encoding="utf-8")
print("bookings includes fixes", n)
