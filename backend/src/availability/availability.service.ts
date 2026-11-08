import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';
import { TEHRAN_TZ, tehranLocalToUtc, tehranWeekdaySun0 } from '../common/timezone';

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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
    if (!pro || pro.status !== 'approved') throw new NotFoundException('زیباگر یافت نشد');

    const weekday = tehranWeekdaySun0(dateStr);
    const hours = await this.prisma.workingHours.findMany({
      where: { professionalId, weekday, isActive: true },
    });
    if (!hours.length) {
      return { date: dateStr, professionalId, durationMin, slots: [], timezone: TEHRAN_TZ };
    }

    const dayStart = tehranLocalToUtc(dateStr, '00:00');
    const dayEnd = tehranLocalToUtc(dateStr, '23:59');

    const [bookings, timeOffs, manuals, breaks] = await Promise.all([
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
      }),
      this.prisma.manualReservation.findMany({
        where: {
          professionalId,
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
      }),
      this.prisma.breakTime.findMany({
        where: { professionalId, weekday },
      }),
    ]);

    const trailingBuffer = Math.max(0, bufferMin || 0);
    const step = 15;
    const slots: { start: string; end: string; available: boolean }[] = [];

    // Tehran "now" for same-day filtering
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

    const busy = [
      ...bookings.map((b) => ({
        start: Math.floor((b.startAt.getTime() - dayStart.getTime()) / 60000),
        end: Math.ceil((b.endAt.getTime() - dayStart.getTime()) / 60000),
      })),
      ...timeOffs.map((b) => ({
        start: Math.floor((b.startAt.getTime() - dayStart.getTime()) / 60000),
        end: Math.ceil((b.endAt.getTime() - dayStart.getTime()) / 60000),
      })),
      ...manuals.map((b) => ({
        start: Math.floor((b.startAt.getTime() - dayStart.getTime()) / 60000),
        end: Math.ceil((b.endAt.getTime() - dayStart.getTime()) / 60000),
      })),
    ];

    for (const wh of hours) {
      const whStart = parseTime(wh.startTime);
      const whEnd = parseTime(wh.endTime);
      const breakRanges = breaks.map((b) => ({
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

    // Public response: do not leak busy/unavailable windows (calendar privacy)
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
